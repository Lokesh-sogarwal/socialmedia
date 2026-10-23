import { Post } from '../models/index.js';
import { BRIEF_USER_FIELDS } from '../models/User.js';
import { ok } from '../utils/respond.js';
import { cursorFilter, pageMeta } from '../utils/pagination.js';
import { decoratePosts } from '../services/serializers.js';
import { acceptedFollowingIds, hiddenUserIds } from '../services/relationshipService.js';

async function page(filter, { cursor, limit }, viewerId) {
  const posts = await Post.find({ ...filter, ...cursorFilter(cursor) })
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('author', BRIEF_USER_FIELDS)
    .lean();
  const { items, meta } = pageMeta(posts.filter((p) => p.author), limit);
  return { items: await decoratePosts(items, viewerId), meta };
}

/**
 * Home feed: chronological posts from accounts you follow plus your own
 * (fan-out on read). Blocks remove follow edges, so blocked authors drop out.
 */
export async function homeFeed(req, res) {
  const following = await acceptedFollowingIds(req.user._id);
  const { items, meta } = await page({ author: { $in: [req.user._id, ...following] } }, req.valid.query, req.user._id);
  return ok(res, items, meta);
}

/** Visible-to-viewer filter for discovery surfaces: public posts plus those of people you follow. */
export async function discoveryFilter(viewerId) {
  if (!viewerId) return { audience: 'public' };
  const [following, hidden] = await Promise.all([acceptedFollowingIds(viewerId), hiddenUserIds(viewerId)]);
  return {
    author: { $nin: hidden },
    $or: [{ audience: 'public' }, { author: { $in: [viewerId, ...following] } }],
  };
}

export async function exploreFeed(req, res) {
  const filter = await discoveryFilter(req.user._id);
  const { items, meta } = await page({ ...filter, 'media.0': { $exists: true } }, req.valid.query, req.user._id);
  return ok(res, items, meta);
}

export async function reelsFeed(req, res) {
  const filter = await discoveryFilter(req.user._id);
  const { items, meta } = await page({ ...filter, hasVideo: true }, req.valid.query, req.user._id);
  return ok(res, items, meta);
}
