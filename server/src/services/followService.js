import { Follow, Notification, User } from '../models/index.js';

async function bumpCounts(followerId, followingId, delta) {
  await Promise.all([
    User.updateOne({ _id: followerId }, { $inc: { followingCount: delta } }),
    User.updateOne({ _id: followingId }, { $inc: { followersCount: delta } }),
  ]);
}

/** Deletes a follow edge (any status) and fixes counters if it was accepted. */
export async function removeFollow(followerId, followingId) {
  const doc = await Follow.findOneAndDelete({ follower: followerId, following: followingId });
  if (doc?.status === 'accepted') await bumpCounts(followerId, followingId, -1);
  if (doc) {
    await Notification.deleteMany({
      actor: followerId,
      recipient: followingId,
      type: { $in: ['follow', 'follow_request'] },
    });
  }
  return doc;
}

/** Transitions pending → accepted exactly once, so counters can't double count. */
export async function acceptFollow(followerId, followingId) {
  const doc = await Follow.findOneAndUpdate(
    { follower: followerId, following: followingId, status: 'pending' },
    { $set: { status: 'accepted' } },
    { returnDocument: 'after' },
  );
  if (doc) await bumpCounts(followerId, followingId, 1);
  return doc;
}

export async function createFollow(followerId, followingId, status) {
  const doc = await Follow.create({ follower: followerId, following: followingId, status });
  if (status === 'accepted') await bumpCounts(followerId, followingId, 1);
  return doc;
}
