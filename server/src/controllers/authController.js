import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { created, ok } from '../utils/respond.js';
import { selfUser } from '../services/serializers.js';
import {
  consumeToken,
  createSession,
  hashPassword,
  revokeAllSessions,
  revokeSession,
  rotateSession,
  sendPasswordResetEmail,
  sendVerificationEmail,
  verifyPassword,
} from '../services/authService.js';

export const REFRESH_COOKIE = 'socio_rt';

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    path: '/api/auth',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, cookieOptions());
}

function clearRefreshCookie(res) {
  const { maxAge: _m, ...opts } = cookieOptions();
  res.clearCookie(REFRESH_COOKIE, opts);
}

async function loadSelf(userId) {
  const user = await User.findById(userId).lean();
  if (!user) throw ApiError.unauthorized();
  return selfUser(user);
}

export async function register(req, res) {
  const { username, email, password, displayName } = req.valid.body;
  const taken = await User.findOne({ $or: [{ username }, { email }] }).select('username email').lean();
  if (taken) {
    const field = taken.username === username ? 'username' : 'email';
    throw ApiError.conflict(field === 'username' ? 'That username is taken' : 'An account with that email already exists', { field });
  }
  const user = await User.create({ username, email, displayName, passwordHash: await hashPassword(password) });
  await sendVerificationEmail(user);
  const { accessToken, refreshToken } = await createSession(user, req.get('user-agent'));
  setRefreshCookie(res, refreshToken);
  return created(res, { user: await loadSelf(user._id), accessToken });
}

export async function login(req, res) {
  const { identifier, password } = req.valid.body;
  const field = identifier.includes('@') ? 'email' : 'username';
  const user = await User.findOne({ [field]: identifier }).select('+passwordHash');
  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email/username or password');
  const { accessToken, refreshToken } = await createSession(user, req.get('user-agent'));
  setRefreshCookie(res, refreshToken);
  return ok(res, { user: await loadSelf(user._id), accessToken });
}

export async function refresh(req, res) {
  try {
    const { accessToken, refreshToken, userId } = await rotateSession(req.cookies?.[REFRESH_COOKIE]);
    setRefreshCookie(res, refreshToken);
    return ok(res, { user: await loadSelf(userId), accessToken });
  } catch (err) {
    clearRefreshCookie(res);
    throw err;
  }
}

export async function logout(req, res) {
  await revokeSession(req.cookies?.[REFRESH_COOKIE]);
  clearRefreshCookie(res);
  return ok(res, { loggedOut: true });
}

export async function logoutAll(req, res) {
  await revokeAllSessions(req.user._id);
  clearRefreshCookie(res);
  return ok(res, { loggedOut: true });
}

export async function me(req, res) {
  return ok(res, { user: await loadSelf(req.user._id) });
}

export async function verifyEmail(req, res) {
  const userId = await consumeToken(req.valid.body.token, 'verify_email');
  await User.updateOne({ _id: userId }, { $set: { emailVerified: true } });
  return ok(res, { verified: true });
}

export async function resendVerification(req, res) {
  const user = await User.findById(req.user._id);
  if (user.emailVerified) return ok(res, { sent: false, alreadyVerified: true });
  await sendVerificationEmail(user);
  return ok(res, { sent: true });
}

export async function forgotPassword(req, res) {
  const user = await User.findOne({ email: req.valid.body.email });
  if (user) await sendPasswordResetEmail(user);
  // Same response either way so the endpoint can't be used to discover accounts.
  return ok(res, { sent: true });
}

export async function resetPassword(req, res) {
  const userId = await consumeToken(req.valid.body.token, 'reset_password');
  await User.updateOne(
    { _id: userId },
    { $set: { passwordHash: await hashPassword(req.valid.body.password), passwordChangedAt: new Date() } },
  );
  await revokeAllSessions(userId);
  return ok(res, { reset: true });
}

export async function changePassword(req, res) {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await verifyPassword(req.valid.body.currentPassword, user.passwordHash))) {
    throw ApiError.badRequest('Current password is incorrect', [{ path: 'body.currentPassword', message: 'Current password is incorrect' }]);
  }
  user.passwordHash = await hashPassword(req.valid.body.newPassword);
  user.passwordChangedAt = new Date();
  await user.save();
  await revokeAllSessions(user._id);
  const { accessToken, refreshToken } = await createSession(user, req.get('user-agent'));
  setRefreshCookie(res, refreshToken);
  return ok(res, { accessToken });
}
