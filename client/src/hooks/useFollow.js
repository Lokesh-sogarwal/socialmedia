import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';

const RELATED = ['profile', 'suggestions', 'followers', 'following', 'search', 'feed', 'stories', 'userPosts', 'likers'];

export function useFollowMutation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ userId, action }) =>
      action === 'follow' ? api.post(`/follows/${userId}`) : api.delete(`/follows/${userId}`),
    onSuccess: () => RELATED.forEach((key) => qc.invalidateQueries({ queryKey: [key] })),
    onError: (err) => toast.error(err.message),
  });
}
