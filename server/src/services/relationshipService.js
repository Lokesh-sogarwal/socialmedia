import { Block, Follow } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

const same = (a, b) => a && b && String(a) === String(b);

export async function isBlockedEitherWay(a, b) {
  if (!a || !b || same(a, b)) return false;
  const hit = await Block.exists({
    $or: [
      { blocker: a, blocked: b },
      { blocker: b, blocked: a },
    ],
  });
  return Boolean(hit);
}

/** IDs of users hidden from `userId`: those they blocked plus those who blocked them. */
export async function hiddenUserIds(userId) {
  if (!userId) return [];
  const rows = await Block.find({ $or: [{ blocker: userId }, { blocked: userId }] })
    .select('blocker blocked')
    .lean();
  return rows.map((r) => (same(r.blocker, userId) ? r.blocked : r.blocker));
}

export async function acceptedFollowingIds(userId) {
  const rows = await Follow.find({ follower: userId, status: 'accepted' }).select('following').lean();
  return rows.map((r) => r.following);
}

export async function getRelationship(viewerId, target) {
  const targetId = target._id;
  if (!viewerId) return { isSelf: false, followStatus: 'none', followsMe: false, blockedByMe: false, blockedMe: false };
  if (same(viewerId, targetId)) {
    return { isSelf: true, followStatus: 'none', followsMe: false, blockedByMe: false, blockedMe: false };
  }
  const [mine, theirs, blocks] = await Promise.all([
    Follow.findOne({ follower: viewerId, following: targetId }).select('status').lean(),
    Follow.findOne({ follower: targetId, following: viewerId, status: 'accepted' }).select('_id').lean(),
    Block.find({
      $or: [
        { blocker: viewerId, blocked: targetId },
        { blocker: targetId, blocked: viewerId },
      ],
    })
      .select('blocker')
      .lean(),
  ]);
  return {
    isSelf: false,
    followStatus: mine?.status ?? 'none',
    followsMe: Boolean(theirs),
    blockedByMe: blocks.some((b) => same(b.blocker, viewerId)),
    blockedMe: blocks.some((b) => same(b.blocker, targetId)),
  };
}

/** Whether `viewerId` may see `owner`'s posts, followers, stories etc. */
export async function canViewContent(viewerId, owner) {
  if (same(viewerId, owner._id)) return true;
  if (viewerId && (await isBlockedEitherWay(viewerId, owner._id))) return false;
  if (!owner.isPrivate) return true;
  if (!viewerId) return false;
  return Boolean(await Follow.exists({ follower: viewerId, following: owner._id, status: 'accepted' }));
}

/** Throws 404 (not 403) for blocked relationships so blocking isn't observable. */
export async function assertNotBlocked(viewerId, otherId, message = 'Not found') {
  if (await isBlockedEitherWay(viewerId, otherId)) throw ApiError.notFound(message);
}
