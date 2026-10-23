import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../services/tokenService.js';
import { User } from '../models/index.js';

const AUTH_FIELDS = '_id username role isPrivate passwordChangedAt emailVerified';

/** Resolves a verified access token to a user; returns null for any invalid token. */
export async function userFromAccessToken(token) {
  if (!token) return null;
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return null;
  }
  const user = await User.findById(payload.sub).select(AUTH_FIELDS).lean();
  if (!user) return null;
  // Tokens issued before a password change are no longer valid.
  if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000) return null;
  return user;
}

function bearer(req) {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

export async function requireAuth(req, _res, next) {
  const user = await userFromAccessToken(bearer(req));
  if (!user) throw ApiError.unauthorized();
  req.user = user;
  next();
}

export async function optionalAuth(req, _res, next) {
  req.user = await userFromAccessToken(bearer(req));
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) throw ApiError.forbidden();
    next();
  };
}
