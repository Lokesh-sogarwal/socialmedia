/**
 * Helpers for keeping one post consistent across every cached list it appears in
 * (home feed, profile grid, hashtag pages, saved, search, post detail).
 */
const POST_LIST_ROOTS = ['feed', 'userPosts', 'hashtag', 'bookmarks', 'search'];

function mapInfinite(data, fn) {
  if (!data) return data;
  if (Array.isArray(data)) return fn(data);
  if (data.pages) return { ...data, pages: data.pages.map((p) => ({ ...p, data: fn(p.data) })) };
  return data;
}

export function updatePostEverywhere(qc, postId, updater) {
  for (const root of POST_LIST_ROOTS) {
    qc.setQueriesData({ queryKey: [root] }, (data) =>
      mapInfinite(data, (items) => items?.map?.((p) => (p?._id === postId && p.author ? { ...p, ...updater(p) } : p)) ?? items),
    );
  }
  qc.setQueryData(['post', postId], (p) => (p ? { ...p, ...updater(p) } : p));
}

export function removePostEverywhere(qc, postId) {
  for (const root of POST_LIST_ROOTS) {
    qc.setQueriesData({ queryKey: [root] }, (data) =>
      mapInfinite(data, (items) => items?.filter?.((p) => p?._id !== postId) ?? items),
    );
  }
  qc.removeQueries({ queryKey: ['post', postId] });
}

/** Snapshot of every query that might contain a post, for optimistic rollback. */
export function snapshotPosts(qc, postId) {
  const keys = [...POST_LIST_ROOTS.map((r) => ({ queryKey: [r] })), { queryKey: ['post', postId] }];
  return keys.flatMap((filter) => qc.getQueriesData(filter));
}

export function restoreSnapshot(qc, snapshot) {
  for (const [key, data] of snapshot) qc.setQueryData(key, data);
}

export function flattenPages(data) {
  return data?.pages?.flatMap((p) => p.data) ?? [];
}

export const nextCursor = (lastPage) => lastPage?.meta?.nextCursor ?? undefined;
