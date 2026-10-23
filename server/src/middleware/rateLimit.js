import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env.js';

function limiter(windowMs, limit, message) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.RATE_LIMIT_DISABLED,
    // Prefer the authenticated user so people behind one NAT don't share a bucket.
    keyGenerator: (req) => (req.user ? `u:${req.user._id}` : `ip:${ipKeyGenerator(req.ip)}`),
    handler: (_req, res) =>
      res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message } }),
  });
}

export const globalLimiter = limiter(60_000, 300, 'Too many requests, slow down a little');
export const authLimiter = limiter(15 * 60_000, 20, 'Too many attempts, please try again later');
export const emailLimiter = limiter(60 * 60_000, 5, 'Too many emails requested, please try again later');
export const writeLimiter = limiter(60_000, 60, 'You are doing that too often');
export const messageLimiter = limiter(60_000, 40, 'You are sending messages too quickly');
export const uploadLimiter = limiter(60 * 60_000, 60, 'Upload limit reached, please try again later');
