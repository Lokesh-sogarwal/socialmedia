import { Router } from 'express';
import { z } from 'zod';
import * as c from '../controllers/userController.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { imageUpload } from '../middleware/upload.js';
import { idParam, pageQuery } from '../validators/common.js';
import { deleteAccountSchema, updateProfileSchema, updateSettingsSchema, usernameParam } from '../validators/users.js';

const postsQuery = pageQuery.extend({ videos: z.enum(['true', 'false']).optional().transform((v) => v === 'true') });

const r = Router();
r.get('/suggestions', requireAuth, validate({ query: z.object({ limit: z.coerce.number().int().min(1).max(20).optional() }).strict() }), c.suggestions);
r.patch('/me', requireAuth, writeLimiter, validate({ body: updateProfileSchema }), c.updateProfile);
r.patch('/me/settings', requireAuth, writeLimiter, validate({ body: updateSettingsSchema }), c.updateSettings);
r.post('/me/avatar', requireAuth, uploadLimiter, imageUpload, c.setAvatar);
r.delete('/me/avatar', requireAuth, c.removeAvatar);
r.post('/me/cover', requireAuth, uploadLimiter, imageUpload, c.setCover);
r.delete('/me/cover', requireAuth, c.removeCover);
r.get('/me/blocked', requireAuth, validate({ query: pageQuery }), c.listBlocked);
r.delete('/me', requireAuth, validate({ body: deleteAccountSchema }), c.removeAccount);
r.post('/:id/block', requireAuth, writeLimiter, validate({ params: idParam }), c.blockUser);
r.delete('/:id/block', requireAuth, validate({ params: idParam }), c.unblockUser);
r.get('/:username', optionalAuth, validate({ params: usernameParam }), c.getProfile);
r.get('/:username/posts', optionalAuth, validate({ params: usernameParam, query: postsQuery }), c.listUserPosts);
r.get('/:username/followers', optionalAuth, validate({ params: usernameParam, query: pageQuery }), c.listFollowers);
r.get('/:username/following', optionalAuth, validate({ params: usernameParam, query: pageQuery }), c.listFollowing);
export default r;
