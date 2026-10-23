import { Router } from 'express';
import * as c from '../controllers/commentController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { idParam } from '../validators/common.js';
import { updateCommentSchema } from '../validators/posts.js';

const r = Router();
r.use(requireAuth);
r.patch('/:id', writeLimiter, validate({ params: idParam, body: updateCommentSchema }), c.updateComment);
r.delete('/:id', validate({ params: idParam }), c.deleteComment);
r.post('/:id/like', writeLimiter, validate({ params: idParam }), c.likeComment);
r.delete('/:id/like', validate({ params: idParam }), c.unlikeComment);
export default r;
