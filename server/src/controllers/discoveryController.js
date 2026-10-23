import { Post, User } from '../models/index.js';
import { BRIEF_USER_FIELDS } from '../models/User.js';
import { ok } from '../utils/respond.js';
import { cursorFilter, pageMeta } from '../utils/pagination.js';
import { escapeRegex } from '../utils/text.js';
import { decoratePosts } from '../services/serializers.js';
import { hiddenUserIds } from '../services/relationshipService.js';
import { discoveryFilter } from './feedController.js';
import { withFollowStatus } from './userController.js';

export async function search(req, res) {
  const { q, type, limit } = req.valid.query;
  const viewerId = req.user._id;

  if (type === 'users') {
    const term = q.replace(/^@/, '');
    const prefix = new RegExp(`^${escapeRegex(term.toLowerCase())}`);
    const anywhere = new RegExp(escapeRegex(term), 'i');
    const hidden = await hiddenUserIds(viewerId);
    const users = await User.find({
      _id: { $nin: hidden },
      $or: [{ username: prefix }, { displayName: anywhere }],
    })
      .sort({ followersCount: -1, _id: 1 })
      .limit(limit)
      .select(BRIEF_USER_FIELDS + ' bio followersCount')
      .lean();
    return ok(res, await withFollowStatus(users, viewerId));
  }

  if (type === 'hashtags') {
    const prefix = new RegExp(`^${escapeRegex(q.replace(/^#/, '').toLowerCase())}`);
    const filter = await discoveryFilter(viewerId);
    const tags = await Post.aggregate([
      { $match: { ...filter, hashtags: prefix } },
      { $unwind: '$hashtags' },
      { $match: { hashtags: prefix } },
      { $group: { _id: '$hashtags', posts: { $sum: 1 } } },
      { $sort: { posts: -1, _id: 1 } },
      { $limit: limit },
    ]);
    return ok(res, tags.map((t) => ({ tag: t._id, posts: t.posts })));
  }

  const filter = await discoveryFilter(viewerId);
  const posts = await Post.find({ $text: { $search: q }, ...filter })
    .sort({ score: { $meta: 'textScore' }, _id: -1 })
    .limit(limit)
    .populate('author', BRIEF_USER_FIELDS)
    .lean();
  return ok(res, await decoratePosts(posts.filter((p) => p.author), viewerId));
}

/** Most-used hashtags on visible posts from the last 7 days. */
export async function trendingHashtags(req, res) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const tags = await Post.aggregate([
    { $match: { audience: 'public', createdAt: { $gte: since }, 'hashtags.0': { $exists: true } } },
    { $unwind: '$hashtags' },
    { $group: { _id: '$hashtags', posts: { $sum: 1 } } },
    { $sort: { posts: -1, _id: 1 } },
    { $limit: 10 },
  ]);
  return ok(res, tags.map((t) => ({ tag: t._id, posts: t.posts })));
}

export async function hashtagPosts(req, res) {
  const { tag } = req.valid.params;
  const { cursor, limit } = req.valid.query;
  const filter = await discoveryFilter(req.user._id);
  const [posts, total] = await Promise.all([
    Post.find({ ...filter, hashtags: tag, ...cursorFilter(cursor) })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate('author', BRIEF_USER_FIELDS)
      .lean(),
    cursor ? null : Post.countDocuments({ ...filter, hashtags: tag }),
  ]);
  const { items, meta } = pageMeta(posts.filter((p) => p.author), limit);
  return ok(res, await decoratePosts(items, req.user._id), { ...meta, ...(total !== null ? { total } : {}) });
}
