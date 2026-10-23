import mongoose from 'mongoose';
import { Comment, Post, User } from '../models/index.js';
import { BRIEF_USER_FIELDS } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { created, ok } from '../utils/respond.js';
import { pageMeta } from '../utils/pagination.js';
import { decorateComments } from '../services/serializers.js';
import { hiddenUserIds } from '../services/relationshipService.js';
import { notify, retractNotification } from '../services/notificationService.js';
import {
  deleteCommentCascade,
  loadVisiblePost,
  resolveAndNotifyMentions,
  setLike,
} from '../services/postService.js';

/** Top-level comments are newest first; replies read oldest first like a thread. */
export async function listComments(req, res) {
  const post = await loadVisiblePost(req.valid.params.id, req.user?._id);
  const { cursor, limit, parent } = req.valid.query;
  const hidden = await hiddenUserIds(req.user?._id);
  const filter = { post: post._id, parent: parent ?? null, author: { $nin: hidden } };
  if (cursor) filter._id = { [parent ? '$gt' : '$lt']: new mongoose.Types.ObjectId(cursor) };
  const rows = await Comment.find(filter)
    .sort({ _id: parent ? 1 : -1 })
    .limit(limit + 1)
    .populate('author', BRIEF_USER_FIELDS)
    .lean();
  const { items, meta } = pageMeta(rows.filter((c) => c.author), limit);
  return ok(res, await decorateComments(items, req.user?._id), meta);
}

export async function createComment(req, res) {
  const post = await loadVisiblePost(req.valid.params.id, req.user._id);
  const { body, parent: parentId } = req.valid.body;
  let parent = null;
  if (parentId) {
    parent = await Comment.findOne({ _id: parentId, post: post._id }).lean();
    if (!parent) throw ApiError.notFound('The comment you are replying to no longer exists');
    if (parent.parent) parent = await Comment.findById(parent.parent).lean(); // flatten to one level
    if (!parent) throw ApiError.notFound('The comment you are replying to no longer exists');
  }
  const comment = await Comment.create({ post: post._id, author: req.user._id, parent: parent?._id ?? null, body });
  await Post.updateOne({ _id: post._id }, { $inc: { commentsCount: 1 } });
  if (parent) await Comment.updateOne({ _id: parent._id }, { $inc: { repliesCount: 1 } });

  const replyTarget = parentId ? (await Comment.findById(parentId).select('author').lean())?.author : null;
  if (replyTarget) {
    await notify({ recipient: replyTarget, actor: req.user._id, type: 'reply', post: post._id, comment: comment._id });
  }
  if (!replyTarget || String(replyTarget) !== String(post.author._id)) {
    await notify({ recipient: post.author._id, actor: req.user._id, type: 'comment', post: post._id, comment: comment._id });
  }
  await resolveAndNotifyMentions(body, {
    actor: req.user._id,
    author: await User.findById(post.author._id).select('_id isPrivate').lean(),
    post: post._id,
    comment: comment._id,
    skip: [post.author._id, replyTarget].filter(Boolean),
  });

  const full = await Comment.findById(comment._id).populate('author', BRIEF_USER_FIELDS).lean();
  return created(res, { ...full, likedByMe: false });
}

export async function updateComment(req, res) {
  const comment = await Comment.findById(req.valid.params.id).lean();
  if (!comment) throw ApiError.notFound('Comment not found');
  if (String(comment.author) !== String(req.user._id)) throw ApiError.forbidden('You can only edit your own comments');
  const updated = await Comment.findByIdAndUpdate(
    comment._id,
    { $set: { body: req.valid.body.body, editedAt: new Date() } },
    { returnDocument: 'after' },
  )
    .populate('author', BRIEF_USER_FIELDS)
    .lean();
  const [decorated] = await decorateComments([updated], req.user._id);
  return ok(res, decorated);
}

/** Comment authors, the post's author and moderators may delete a comment. */
export async function deleteComment(req, res) {
  const comment = await Comment.findById(req.valid.params.id).lean();
  if (!comment) throw ApiError.notFound('Comment not found');
  const post = await Post.findById(comment.post).select('author').lean();
  const me = String(req.user._id);
  const allowed =
    String(comment.author) === me ||
    String(post?.author) === me ||
    ['moderator', 'admin'].includes(req.user.role);
  if (!allowed) throw ApiError.forbidden('You can only delete your own comments');
  await deleteCommentCascade(comment);
  return ok(res, { deleted: true });
}

async function loadVisibleComment(id, viewerId) {
  const comment = await Comment.findById(id).lean();
  if (!comment) throw ApiError.notFound('Comment not found');
  await loadVisiblePost(comment.post, viewerId);
  return comment;
}

export async function likeComment(req, res) {
  const comment = await loadVisibleComment(req.valid.params.id, req.user._id);
  const { changed, likesCount } = await setLike(Comment, 'comment', comment._id, req.user._id, true);
  if (changed) {
    await notify({ recipient: comment.author, actor: req.user._id, type: 'like_comment', post: comment.post, comment: comment._id });
  }
  return ok(res, { liked: true, likesCount });
}

export async function unlikeComment(req, res) {
  const comment = await loadVisibleComment(req.valid.params.id, req.user._id);
  const { changed, likesCount } = await setLike(Comment, 'comment', comment._id, req.user._id, false);
  if (changed) {
    await retractNotification({ recipient: comment.author, actor: req.user._id, type: 'like_comment', post: comment.post, comment: comment._id });
  }
  return ok(res, { liked: false, likesCount });
}
