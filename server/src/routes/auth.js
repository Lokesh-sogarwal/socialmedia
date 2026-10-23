import { Router } from 'express';
import * as c from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter, emailLimiter } from '../middleware/rateLimit.js';
import { ApiError } from '../utils/ApiError.js';
import {
  changePasswordSchema,
  forgotSchema,
  loginSchema,
  registerSchema,
  resetSchema,
  tokenSchema,
} from '../validators/auth.js';

/**
 * Cookie-authenticated endpoints require a custom header. Browsers can't send it
 * cross-origin without a CORS preflight, which our origin allow-list rejects — a CSRF guard.
 */
function requireXhr(req, _res, next) {
  if (req.get('x-requested-with') !== 'XMLHttpRequest') throw ApiError.forbidden('Missing request header');
  next();
}

const r = Router();
r.post('/register', authLimiter, validate({ body: registerSchema }), c.register);
r.post('/login', authLimiter, validate({ body: loginSchema }), c.login);
r.post('/refresh', requireXhr, c.refresh);
r.post('/logout', requireXhr, c.logout);
r.post('/logout-all', requireAuth, c.logoutAll);
r.get('/me', requireAuth, c.me);
r.post('/verify-email', authLimiter, validate({ body: tokenSchema }), c.verifyEmail);
r.post('/resend-verification', requireAuth, emailLimiter, c.resendVerification);
r.post('/forgot-password', emailLimiter, validate({ body: forgotSchema }), c.forgotPassword);
r.post('/reset-password', authLimiter, validate({ body: resetSchema }), c.resetPassword);
r.post('/change-password', requireAuth, authLimiter, validate({ body: changePasswordSchema }), c.changePassword);
export default r;
