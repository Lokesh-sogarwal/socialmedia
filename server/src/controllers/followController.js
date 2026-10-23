import { Follow, User } from '../models/index.js';
import { BRIEF_USER_FIELDS } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/respond.js';
import { cursorFilter, pageMeta } from '../utils/pagination.js';
import { assertNotBlocked } from '../services/relationshipService.js';
import { acceptFollow, createFollow, removeFollow } from '../services/followService.js';
import { notify, retractNotification } from '../services/notificationService.js';

export async function follow(req, res) {
  const me = req.user._id;
  const target = await User.findById(req.valid.params.id).select('_id isPrivate').lean();
  if (!target) throw ApiError.notFound('User not found');
  if (String(target._id) === String(me)) throw ApiError.badRequest("You can't follow yourself");
  await assertNotBlocked(me, target._id, 'User not found');

  const existing = await Follow.findOne({ follower: me, following: target._id }).lean();
  if (existing) return ok(res, { status: existing.status });

  const status = target.isPrivate ? 'pending' : 'accepted';
  try {
    await createFollow(me, target._id, status);
  } catch (err) {
    if (err?.code !== 11000) throw err;
    const row = await Follow.findOne({ follower: me, following: target._id }).lean();
    return ok(res, { status: row?.status ?? status });
  }
  await notify({ recipient: target._id, actor: me, type: status === 'pending' ? 'follow_request' : 'follow' });
  return ok(res, { status });
}

export async function unfollow(req, res) {
  await removeFollow(req.user._id, req.valid.params.id);
  return ok(res, { status: 'none' });
}

export async function removeFollower(req, res) {
  await removeFollow(req.valid.params.id, req.user._id);
  return ok(res, { removed: true });
}

export async function listRequests(req, res) {
  const { cursor, limit } = req.valid.query;
  const rows = await Follow.find({ following: req.user._id, status: 'pending', ...cursorFilter(cursor) })
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('follower', BRIEF_USER_FIELDS)
    .lean();
  const { items, meta } = pageMeta(rows, limit);
  return ok(
    res,
    items.filter((r) => r.follower).map((r) => ({ _id: r._id, user: r.follower, createdAt: r.createdAt })),
    meta,
  );
}

export async function acceptRequest(req, res) {
  const doc = await acceptFollow(req.valid.params.id, req.user._id);
  if (!doc) throw ApiError.notFound('Follow request not found');
  await retractNotification({ recipient: req.user._id, actor: req.valid.params.id, type: 'follow_request' });
  await notify({ recipient: req.valid.params.id, actor: req.user._id, type: 'follow_accept' });
  await notify({ recipient: req.user._id, actor: req.valid.params.id, type: 'follow' });
  return ok(res, { status: 'accepted' });
}

export async function declineRequest(req, res) {
  const doc = await Follow.findOneAndDelete({ follower: req.valid.params.id, following: req.user._id, status: 'pending' });
  if (!doc) throw ApiError.notFound('Follow request not found');
  await retractNotification({ recipient: req.user._id, actor: req.valid.params.id, type: 'follow_request' });
  return ok(res, { status: 'none' });
}
