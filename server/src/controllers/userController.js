import { Block, Follow, Post, User } from '../models/index.js';
import { BRIEF_USER_FIELDS, PUBLIC_USER_FIELDS } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/respond.js';
import { cursorFilter, pageMeta } from '../utils/pagination.js';
import { decoratePosts, selfUser } from '../services/serializers.js';
import {
  acceptedFollowingIds,
  canViewContent,
  getRelationship,
  hiddenUserIds,
  isBlockedEitherWay,
} from '../services/relationshipService.js';
import { acceptFollow, removeFollow } from '../services/followService.js';
import { removeMedia, storeUploads } from '../services/storage.js';
import { deleteAccount } from '../services/accountService.js';
import { verifyPassword } from '../services/authService.js';

async function findVisibleUser(username, viewerId) {
  const user = await User.findOne({ username }).select(PUBLIC_USER_FIELDS).lean();
  if (!user || (viewerId && (await isBlockedEitherWay(viewerId, user._id)))) {
    throw ApiError.notFound('User not found');
  }
  return user;
}

export async function getProfile(req, res) {
  const user = await findVisibleUser(req.valid.params.username, req.user?._id);
  const [relationship, canView] = await Promise.all([
    getRelationship(req.user?._id, user),
    canViewContent(req.user?._id, user),
  ]);
  return ok(res, { user, relationship, canView });
}

export async function updateProfile(req, res) {
  const updates = req.valid.body;
  if (updates.username) {
    const taken = await User.exists({ username: updates.username, _id: { $ne: req.user._id } });
    if (taken) throw ApiError.conflict('That username is taken', { field: 'username' });
  }
  const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { returnDocument: 'after', runValidators: true }).lean();
  return ok(res, { user: selfUser(user) });
}

export async function updateSettings(req, res) {
  const updates = req.valid.body;
  const before = await User.findById(req.user._id).select('isPrivate').lean();
  const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { returnDocument: 'after' }).lean();
  if (updates.isPrivate !== undefined && updates.isPrivate !== before.isPrivate) {
    await Post.updateMany({ author: req.user._id }, { $set: { audience: updates.isPrivate ? 'followers' : 'public' } });
    if (!updates.isPrivate) {
      // Going public approves everyone who was waiting.
      const pending = await Follow.find({ following: req.user._id, status: 'pending' }).select('follower').lean();
      for (const p of pending) await acceptFollow(p.follower, req.user._id);
    }
  }
  const fresh = updates.isPrivate === false ? await User.findById(req.user._id).lean() : user;
  return ok(res, { user: selfUser(fresh) });
}

function imageSetter(field) {
  return async (req, res) => {
    if (!req.files?.length) throw ApiError.badRequest('Choose an image to upload');
    const [media] = await storeUploads(req.files, {
      folder: field === 'avatar' ? 'avatars' : 'covers',
      imagesOnly: true,
      maxDimension: field === 'avatar' ? 512 : 1600,
    });
    const before = await User.findById(req.user._id).select(field).lean();
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { [field]: { url: media.url, key: media.key } } },
      { returnDocument: 'after' },
    ).lean();
    await removeMedia([before?.[field]]);
    return ok(res, { user: selfUser(user) });
  };
}

function imageRemover(field) {
  return async (req, res) => {
    const before = await User.findById(req.user._id).select(field).lean();
    const user = await User.findByIdAndUpdate(req.user._id, { $set: { [field]: null } }, { returnDocument: 'after' }).lean();
    await removeMedia([before?.[field]]);
    return ok(res, { user: selfUser(user) });
  };
}

export const setAvatar = imageSetter('avatar');
export const setCover = imageSetter('cover');
export const removeAvatar = imageRemover('avatar');
export const removeCover = imageRemover('cover');

export async function removeAccount(req, res) {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await verifyPassword(req.valid.body.password, user.passwordHash))) {
    throw ApiError.badRequest('Password is incorrect');
  }
  await deleteAccount(user._id);
  res.clearCookie('socio_rt', { path: '/api/auth' });
  return ok(res, { deleted: true });
}

export async function listUserPosts(req, res) {
  const owner = await findVisibleUser(req.valid.params.username, req.user?._id);
  if (!(await canViewContent(req.user?._id, owner))) throw ApiError.forbidden('This account is private');
  const { cursor, limit } = req.valid.query;
  const filter = { author: owner._id, ...cursorFilter(cursor) };
  if (req.valid.query.videos) filter.hasVideo = true;
  const posts = await Post.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('author', BRIEF_USER_FIELDS)
    .lean();
  const { items, meta } = pageMeta(posts, limit);
  return ok(res, await decoratePosts(items, req.user?._id), meta);
}

function connectionLister(direction) {
  return async (req, res) => {
    const owner = await findVisibleUser(req.valid.params.username, req.user?._id);
    if (!(await canViewContent(req.user?._id, owner))) throw ApiError.forbidden('This account is private');
    const { cursor, limit } = req.valid.query;
    const [ownField, otherField] = direction === 'followers' ? ['following', 'follower'] : ['follower', 'following'];
    const hidden = await hiddenUserIds(req.user?._id);
    const rows = await Follow.find({
      [ownField]: owner._id,
      status: 'accepted',
      [otherField]: { $nin: hidden },
      ...cursorFilter(cursor),
    })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate(otherField, BRIEF_USER_FIELDS + ' bio')
      .lean();
    const { items, meta } = pageMeta(rows, limit);
    const users = items.filter((r) => r[otherField]).map((r) => r[otherField]);
    return ok(res, await withFollowStatus(users, req.user?._id), meta);
  };
}

export const listFollowers = connectionLister('followers');
export const listFollowing = connectionLister('following');

/** Adds the viewer's follow status to each user in one query. */
export async function withFollowStatus(users, viewerId) {
  if (!viewerId || !users.length) return users.map((u) => ({ ...u, followStatus: 'none' }));
  const rows = await Follow.find({ follower: viewerId, following: { $in: users.map((u) => u._id) } })
    .select('following status')
    .lean();
  const byId = new Map(rows.map((r) => [String(r.following), r.status]));
  return users.map((u) => ({
    ...u,
    isSelf: String(u._id) === String(viewerId),
    followStatus: byId.get(String(u._id)) ?? 'none',
  }));
}

/**
 * Suggestions: accounts followed by people you follow (friends-of-friends),
 * topped up with popular accounts. Excludes self, existing follows and blocks.
 */
export async function suggestions(req, res) {
  const me = req.user._id;
  const limit = Math.min(Number(req.valid.query.limit) || 5, 20);
  const [following, hidden, pendingRows] = await Promise.all([
    acceptedFollowingIds(me),
    hiddenUserIds(me),
    Follow.find({ follower: me, status: 'pending' }).select('following').lean(),
  ]);
  const exclude = [me, ...following, ...hidden, ...pendingRows.map((r) => r.following)];
  const fof = await Follow.aggregate([
    { $match: { follower: { $in: following }, status: 'accepted', following: { $nin: exclude } } },
    { $group: { _id: '$following', mutuals: { $sum: 1 } } },
    { $sort: { mutuals: -1 } },
    { $limit: limit },
  ]);
  const ids = fof.map((f) => f._id);
  let users = await User.find({ _id: { $in: ids } }).select(BRIEF_USER_FIELDS + ' bio followersCount').lean();
  const mutuals = new Map(fof.map((f) => [String(f._id), f.mutuals]));
  users = users.map((u) => ({ ...u, mutuals: mutuals.get(String(u._id)) ?? 0 })).sort((a, b) => b.mutuals - a.mutuals);
  if (users.length < limit) {
    const popular = await User.find({ _id: { $nin: [...exclude, ...ids] } })
      .sort({ followersCount: -1, _id: -1 })
      .limit(limit - users.length)
      .select(BRIEF_USER_FIELDS + ' bio followersCount')
      .lean();
    users = users.concat(popular.map((u) => ({ ...u, mutuals: 0 })));
  }
  return ok(res, await withFollowStatus(users, me));
}

export async function blockUser(req, res) {
  const me = req.user._id;
  const target = await User.findById(req.valid.params.id).select('_id').lean();
  if (!target) throw ApiError.notFound('User not found');
  if (String(target._id) === String(me)) throw ApiError.badRequest("You can't block yourself");
  await Block.updateOne({ blocker: me, blocked: target._id }, { $setOnInsert: { blocker: me, blocked: target._id } }, { upsert: true });
  await Promise.all([removeFollow(me, target._id), removeFollow(target._id, me)]);
  return ok(res, { blocked: true });
}

export async function unblockUser(req, res) {
  await Block.deleteOne({ blocker: req.user._id, blocked: req.valid.params.id });
  return ok(res, { blocked: false });
}

export async function listBlocked(req, res) {
  const { cursor, limit } = req.valid.query;
  const rows = await Block.find({ blocker: req.user._id, ...cursorFilter(cursor) })
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('blocked', BRIEF_USER_FIELDS)
    .lean();
  const { items, meta } = pageMeta(rows, limit);
  return ok(res, items.filter((r) => r.blocked).map((r) => r.blocked), meta);
}
