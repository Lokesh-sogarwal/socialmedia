import { Bookmark, Comment, Like, Notification, Post, User } from '../models/index.js';
import { BRIEF_USER_FIELDS } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { extractMentions } from '../utils/text.js';
import { canViewContent } from './relationshipService.js';
import { notify } from './notificationService.js';
import { removeMedia } from './storage.js';

/** Loads a post and enforces the viewer's right to see it (404 when not allowed). */
export async function loadVisiblePost(postId, viewerId) {
  const post = await Post.findById(postId).populate('author', BRIEF_USER_FIELDS).lean();
  if (!post || !post.author || !(await canViewContent(viewerId, post.author))) {
    throw ApiError.notFound('Post not found');
  }
  return post;
}

/** Resolves @mentions to user ids and notifies mentioned users who can see the content. */
export async function resolveAndNotifyMentions(text, { actor, author, post, comment, skip = [] }) {
  const names = extractMentions(text);
  if (!names.length) return [];
  const users = await User.find({ username: { $in: names } }).select('_id').lean();
  const skipSet = new Set(skip.map(String));
  for (const u of users) {
    if (skipSet.has(String(u._id))) continue;
    if (await canViewContent(u._id, author)) {
      await notify({ recipient: u._id, actor, type: 'mention', post, comment: comment ?? null });
    }
  }
  return users.map((u) => u._id);
}

/** Removes a post and everything hanging off it, keeping counters consistent. */
export async function deletePostCascade(post) {
  const { deletedCount } = await Post.deleteOne({ _id: post._id });
  if (!deletedCount) return;
  const commentIds = (await Comment.find({ post: post._id }).select('_id').lean()).map((c) => c._id);
  await Promise.all([
    Comment.deleteMany({ post: post._id }),
    Like.deleteMany({ $or: [{ targetType: 'post', target: post._id }, { targetType: 'comment', target: { $in: commentIds } }] }),
    Bookmark.deleteMany({ post: post._id }),
    Notification.deleteMany({ post: post._id }),
    User.updateOne({ _id: post.author._id ?? post.author, postsCount: { $gt: 0 } }, { $inc: { postsCount: -1 } }),
  ]);
  await removeMedia(post.media);
}

/** Deletes a comment (and its replies when top-level) and fixes counters. */
export async function deleteCommentCascade(comment) {
  const replyIds = comment.parent
    ? []
    : (await Comment.find({ parent: comment._id }).select('_id').lean()).map((c) => c._id);
  const ids = [comment._id, ...replyIds];
  const { deletedCount } = await Comment.deleteMany({ _id: { $in: ids } });
  if (!deletedCount) return;
  await Promise.all([
    Like.deleteMany({ targetType: 'comment', target: { $in: ids } }),
    Notification.deleteMany({ comment: { $in: ids } }),
    Post.updateOne({ _id: comment.post }, { $inc: { commentsCount: -deletedCount } }),
    comment.parent ? Comment.updateOne({ _id: comment.parent }, { $inc: { repliesCount: -1 } }) : null,
  ]);
  // Guard against drift below zero from concurrent deletes.
  await Post.updateOne({ _id: comment.post, commentsCount: { $lt: 0 } }, { $set: { commentsCount: 0 } });
}

/** Idempotent like/unlike; counter only moves when the Like row actually changes. */
export async function setLike(Model, targetType, targetId, userId, liked) {
  let changed = false;
  if (liked) {
    try {
      await Like.create({ user: userId, targetType, target: targetId });
      changed = true;
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  } else {
    const { deletedCount } = await Like.deleteOne({ user: userId, targetType, target: targetId });
    changed = deletedCount > 0;
  }
  const filter = liked ? { _id: targetId } : { _id: targetId, likesCount: { $gt: 0 } };
  const doc = changed
    ? await Model.findOneAndUpdate(filter, { $inc: { likesCount: liked ? 1 : -1 } }, { returnDocument: 'after' }).lean()
    : await Model.findById(targetId).lean();
  return { changed, likesCount: doc?.likesCount ?? 0 };
}
