import { useInfiniteQuery } from '@tanstack/react-query';
import { Modal } from '../ui/Modal.jsx';
import { UserCard } from '../users/UserCard.jsx';
import { UserRowSkeleton } from '../ui/SkeletonLoader.jsx';
import { ErrorState } from '../ui/States.jsx';
import { InfiniteSentinel } from '../ui/InfiniteSentinel.jsx';
import { api } from '../../lib/api.js';
import { flattenPages, nextCursor } from '../../lib/cache.js';

export function LikersModal({ postId, onClose }) {
  const query = useInfiniteQuery({
    queryKey: ['likers', postId],
    queryFn: ({ pageParam }) => api.page(`/posts/${postId}/likes`, { cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: nextCursor,
  });
  const users = flattenPages(query.data);
  return (
    <Modal title="Likes" onClose={onClose} size="sm">
      <div className="space-y-4 p-5">
        {query.isPending && <UserRowSkeleton />}
        {query.isError && <ErrorState error={query.error} onRetry={query.refetch} />}
        {users.map((u) => (
          <UserCard key={u._id} user={u} />
        ))}
        <InfiniteSentinel query={query} />
      </div>
    </Modal>
  );
}
