import { PostCard } from './PostCard.jsx';
import { PostSkeleton } from '../ui/SkeletonLoader.jsx';
import { ErrorState } from '../ui/States.jsx';
import { InfiniteSentinel } from '../ui/InfiniteSentinel.jsx';
import { flattenPages } from '../../lib/cache.js';

export function PostList({ query, empty, endLabel = 'You’re all caught up' }) {
  const posts = flattenPages(query.data);
  if (query.isPending) {
    return (
      <div className="space-y-5">
        <PostSkeleton />
        <PostSkeleton />
      </div>
    );
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!posts.length) return empty;
  return (
    <div className="space-y-5">
      {posts.map((p) => (
        <PostCard key={p._id} post={p} />
      ))}
      <InfiniteSentinel query={query} endLabel={endLabel} />
    </div>
  );
}
