import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { Session, Token, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { generateOpaqueToken, hashToken, signAccessToken } from './tokenService.js';
import { sendMail } from './mailer.js';

const BCRYPT_ROUNDS = env.isTest ? 4 : 12;
const DAY = 24 * 60 * 60 * 1000;
// Equalises timing between "no such user" and "wrong password".
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);

export const hashPassword = (pw) => bcrypt.hash(pw, BCRYPT_ROUNDS);
export const verifyPassword = (pw, hash) => bcrypt.compare(pw, hash || DUMMY_HASH);

export async function createSession(user, userAgent) {
  const refreshToken = generateOpaqueToken();
  await Session.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    userAgent: userAgent?.slice(0, 300),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * DAY),
  });
  return { accessToken: signAccessToken(user), refreshToken };
}

/** Rotates a refresh token. Reuse of an already-rotated token revokes the whole session. */
export async function rotateSession(refreshToken) {
  if (!refreshToken) throw ApiError.unauthorized('Session expired');
  const hash = hashToken(refreshToken);
  const next = generateOpaqueToken();
  const session = await Session.findOneAndUpdate(
    { tokenHash: hash, revokedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { tokenHash: hashToken(next) }, $push: { previousHashes: { $each: [hash], $slice: -20 } } },
    { returnDocument: 'after' },
  );
  if (!session) {
    const reused = await Session.findOneAndUpdate(
      { previousHashes: hash, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    if (reused) throw ApiError.unauthorized('Session was revoked. Please log in again');
    throw ApiError.unauthorized('Session expired');
  }
  const user = await User.findById(session.user).select('_id role');
  if (!user) throw ApiError.unauthorized('Session expired');
  return { accessToken: signAccessToken(user), refreshToken: next, userId: user._id };
}

export async function revokeSession(refreshToken) {
  if (!refreshToken) return;
  await Session.updateOne({ tokenHash: hashToken(refreshToken) }, { $set: { revokedAt: new Date() } });
}

export async function revokeAllSessions(userId) {
  await Session.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

async function issueToken(user, type, ttlMs) {
  await Token.deleteMany({ user: user._id, type });
  const token = generateOpaqueToken();
  await Token.create({ user: user._id, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) });
  return token;
}

export async function consumeToken(token, type) {
  const doc = await Token.findOneAndDelete({ tokenHash: hashToken(token), type, expiresAt: { $gt: new Date() } });
  if (!doc) throw ApiError.badRequest('This link is invalid or has expired');
  return doc.user;
}

export async function sendVerificationEmail(user) {
  const token = await issueToken(user, 'verify_email', 2 * DAY);
  const link = `${env.APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: user.email,
    subject: 'Verify your Socio email',
    text: `Hi ${user.displayName},\n\nConfirm your email address by opening this link:\n${link}\n\nThe link expires in 48 hours.`,
    link,
  });
}

export async function sendPasswordResetEmail(user) {
  const token = await issueToken(user, 'reset_password', 60 * 60 * 1000);
  const link = `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: user.email,
    subject: 'Reset your Socio password',
    text: `Someone asked to reset your Socio password. If that was you, open this link within an hour:\n${link}\n\nIf it wasn't, you can ignore this email.`,
    link,
  });
}
