import { Router } from 'express';
import * as c from '../controllers/followController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { idParam, pageQuery } from '../validators/common.js';

const r = Router();
r.use(requireAuth);
r.get('/requests', validate({ query: pageQuery }), c.listRequests);
r.post('/requests/:id/accept', validate({ params: idParam }), c.acceptRequest);
r.delete('/requests/:id', validate({ params: idParam }), c.declineRequest);
r.delete('/followers/:id', validate({ params: idParam }), c.removeFollower);
r.post('/:id', writeLimiter, validate({ params: idParam }), c.follow);
r.delete('/:id', validate({ params: idParam }), c.unfollow);
export default r;
