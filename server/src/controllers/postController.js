import { Bookmark, Like, Post, User } from '../models/index.js';
import { BRIEF_USER_FIELDS } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { created, ok } from '../utils/respond.js';
import { cursorFilter, pageMeta } from '../utils/pagination.js';
import { extractHashtags } from '../utils/text.js';
import { decoratePosts } from '../services/serializers.js';
import { cleanupTempFiles, removeMedia, storeUploads } from '../services/storage.js';
import { canViewContent, hiddenUserIds } from '../services/relationshipService.js';
import { notify, retractNotification } from '../services/notificationService.js';
import {
  deletePostCascade,
  loadVisiblePost,
  resolveAndNotifyMentions,
  setLike,
} from '../services/postService.js';
import { withFollowStatus } from './userController.js';

export async function createPost(req, res) {
  const files = req.files || [];
  const { caption } = req.valid.body;
  if (!caption && !files.length) {
    await cleanupTempFiles(files);
    throw ApiError.badRequest('Add a caption or at least one photo or video');
  }
  if (files.filter((f) => f.mimetype.startsWith('video/')).length > 1) {
    await cleanupTempFiles(files);
    throw ApiError.badRequest('A post can include at most one video');
  }
  const media = files.length ? await storeUploads(files, { folder: 'posts' }) : [];
  if (media.filter((m) => m.type === 'video').length > 1) {
    // Declared types lied; the sniffed content says otherwise.
    await removeMedia(media);
    throw ApiError.badRequest('A post can include at most one video');
  }
  const author = await User.findById(req.user._id).select('_id isPrivate username').lean();
  const post = await Post.create({
    author: author._id,
    caption,
    media,
    hasVideo: media.some((m) => m.type === 'video'),
    hashtags: extractHashtags(caption),
    audience: author.isPrivate ? 'followers' : 'public',
  });
  await User.updateOne({ _id: author._id }, { $inc: { postsCount: 1 } });
  post.mentions = await resolveAndNotifyMentions(caption, { actor: author._id, author, post: post._id });
  await post.save();
  const full = await Post.findById(post._id).populate('author', BRIEF_USER_FIELDS).lean();
  const [decorated] = await decoratePosts([full], req.user._id);
  return created(res, decorated);
}

export async function getPost(req, res) {
  const post = await loadVisiblePost(req.valid.params.id, req.user?._id);
  const [decorated] = await decoratePosts([post], req.user?._id);
  return ok(res, decorated);
}

async function loadOwnPost(id, userId) {
  const post = await Post.findById(id).lean();
  if (!post) throw ApiError.notFound('Post not found');
  if (String(post.author) !== String(userId)) throw ApiError.forbidden('You can only change your own posts');
  return post;
}

export async function updatePost(req, res) {
  const post = await loadOwnPost(req.valid.params.id, req.user._id);
  const { caption } = req.valid.body;
  if (!caption && !post.media.length) throw ApiError.badRequest('A post without media needs a caption');
  const author = await User.findById(req.user._id).select('_id isPrivate').lean();
  const mentions = await resolveAndNotifyMentions(caption, {
    actor: author._id,
    author,
    post: post._id,
    skip: post.mentions,
  });
  const updated = await Post.findByIdAndUpdate(
    post._id,
    { $set: { caption, hashtags: extractHashtags(caption), mentions, editedAt: new Date() } },
    { returnDocument: 'after' },
  )
    .populate('author', BRIEF_USER_FIELDS)
    .lean();
  const [decorated] = await decoratePosts([updated], req.user._id);
  return ok(res, decorated);
}

export async function deletePost(req, res) {
  const post = await Post.findById(req.valid.params.id).lean();
  if (!post) throw ApiError.notFound('Post not found');
  const isOwner = String(post.author) === String(req.user._id);
  const isModerator = ['moderator', 'admin'].includes(req.user.role);
  if (!isOwner && !isModerator) throw ApiError.forbidden('You can only delete your own posts');
  await deletePostCascade(post);
  return ok(res, { deleted: true });
}

export async function likePost(req, res) {
  const post = await loadVisiblePost(req.valid.params.id, req.user._id);
  const { changed, likesCount } = await setLike(Post, 'post', post._id, req.user._id, true);
  if (changed) await notify({ recipient: post.author._id, actor: req.user._id, type: 'like_post', post: post._id });
  return ok(res, { liked: true, likesCount });
}

export async function unlikePost(req, res) {
  const post = await loadVisiblePost(req.valid.params.id, req.user._id);
  const { changed, likesCount } = await setLike(Post, 'post', post._id, req.user._id, false);
  if (changed) await retractNotification({ recipient: post.author._id, actor: req.user._id, type: 'like_post', post: post._id });
  return ok(res, { liked: false, likesCount });
}

export async function listLikers(req, res) {
  const post = await loadVisiblePost(req.valid.params.id, req.user._id);
  const { cursor, limit } = req.valid.query;
  const hidden = await hiddenUserIds(req.user._id);
  const rows = await Like.find({ targetType: 'post', target: post._id, user: { $nin: hidden }, ...cursorFilter(cursor) })
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('user', BRIEF_USER_FIELDS)
    .lean();
  const { items, meta } = pageMeta(rows, limit);
  return ok(res, await withFollowStatus(items.filter((r) => r.user).map((r) => r.user), req.user._id), meta);
}

export async function bookmark(req, res) {
  const post = await loadVisiblePost(req.valid.params.id, req.user._id);
  await Bookmark.updateOne(
    { user: req.user._id, post: post._id },
    { $setOnInsert: { user: req.user._id, post: post._id } },
    { upsert: true },
  );
  return ok(res, { bookmarked: true });
}

export async function unbookmark(req, res) {
  await Bookmark.deleteOne({ user: req.user._id, post: req.valid.params.id });
  return ok(res, { bookmarked: false });
}

export async function listBookmarks(req, res) {
  const { cursor, limit } = req.valid.query;
  const rows = await Bookmark.find({ user: req.user._id, ...cursorFilter(cursor) })
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate({ path: 'post', populate: { path: 'author', select: BRIEF_USER_FIELDS } })
    .lean();
  const { items, meta } = pageMeta(rows, limit);
  const hidden = new Set((await hiddenUserIds(req.user._id)).map(String));
  // Saved posts whose author went private (and you no longer follow) stay saved but are hidden.
  const visible = [];
  for (const row of items) {
    if (!row.post?.author || hidden.has(String(row.post.author._id))) continue;
    if (await canViewContent(req.user._id, row.post.author)) visible.push(row.post);
  }
  return ok(res, await decoratePosts(visible, req.user._id), meta);
}
