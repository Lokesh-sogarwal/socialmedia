import { Bookmark, Like } from '../models/index.js';

function idSet(rows, field) {
  return new Set(rows.map((r) => String(r[field])));
}

/** Adds viewer-specific flags in two batched queries (no N+1). */
export async function decoratePosts(posts, viewerId) {
  if (!posts.length) return posts;
  if (!viewerId) return posts.map((p) => ({ ...p, likedByMe: false, bookmarkedByMe: false }));
  const ids = posts.map((p) => p._id);
  const [likes, marks] = await Promise.all([
    Like.find({ user: viewerId, targetType: 'post', target: { $in: ids } }).select('target').lean(),
    Bookmark.find({ user: viewerId, post: { $in: ids } }).select('post').lean(),
  ]);
  const liked = idSet(likes, 'target');
  const marked = idSet(marks, 'post');
  return posts.map((p) => ({ ...p, likedByMe: liked.has(String(p._id)), bookmarkedByMe: marked.has(String(p._id)) }));
}

export async function decorateComments(comments, viewerId) {
  if (!comments.length || !viewerId) return comments.map((c) => ({ ...c, likedByMe: false }));
  const likes = await Like.find({
    user: viewerId,
    targetType: 'comment',
    target: { $in: comments.map((c) => c._id) },
  })
    .select('target')
    .lean();
  const liked = idSet(likes, 'target');
  return comments.map((c) => ({ ...c, likedByMe: liked.has(String(c._id)) }));
}

export function selfUser(user) {
  const { passwordHash: _omit, __v: _v, ...rest } = user;
  return rest;
}
