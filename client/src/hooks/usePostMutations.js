import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { removePostEverywhere, restoreSnapshot, snapshotPosts, updatePostEverywhere } from '../lib/cache.js';
import { useToast } from '../context/ToastContext.jsx';

/** Optimistic like/bookmark with rollback; the server's counts win once it replies. */
export function usePostMutations(post) {
  const qc = useQueryClient();
  const toast = useToast();
  const id = post._id;

  const like = useMutation({
    mutationFn: (liked) => (liked ? api.post(`/posts/${id}/like`) : api.delete(`/posts/${id}/like`)),
    onMutate: async (liked) => {
      const snapshot = snapshotPosts(qc, id);
      updatePostEverywhere(qc, id, (p) => ({
        likedByMe: liked,
        likesCount: Math.max(0, p.likesCount + (liked === p.likedByMe ? 0 : liked ? 1 : -1)),
      }));
      return { snapshot };
    },
    onError: (err, _v, ctx) => {
      restoreSnapshot(qc, ctx.snapshot);
      toast.error(err.message);
    },
    onSuccess: (data) => updatePostEverywhere(qc, id, () => ({ likedByMe: data.liked, likesCount: data.likesCount })),
  });

  const bookmark = useMutation({
    mutationFn: (saved) => (saved ? api.post(`/posts/${id}/bookmark`) : api.delete(`/posts/${id}/bookmark`)),
    onMutate: async (saved) => {
      const snapshot = snapshotPosts(qc, id);
      updatePostEverywhere(qc, id, () => ({ bookmarkedByMe: saved }));
      return { snapshot };
    },
    onError: (err, _v, ctx) => {
      restoreSnapshot(qc, ctx.snapshot);
      toast.error(err.message);
    },
    onSuccess: (data) => {
      toast.success(data.bookmarked ? 'Saved to your collection' : 'Removed from saved');
      qc.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/posts/${id}`),
    onSuccess: () => {
      removePostEverywhere(qc, id);
      qc.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Post deleted');
    },
    onError: (err) => toast.error(err.message),
  });

  return { like, bookmark, remove };
}
