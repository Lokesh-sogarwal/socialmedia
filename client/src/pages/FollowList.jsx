import { Link, useParams } from 'react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Users } from 'lucide-react';
import { api } from '../lib/api.js';
import { flattenPages, nextCursor } from '../lib/cache.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { UserCard } from '../components/users/UserCard.jsx';
import { UserRowSkeleton } from '../components/ui/SkeletonLoader.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { InfiniteSentinel } from '../components/ui/InfiniteSentinel.jsx';

export default function FollowList({ kind }) {
  const { username } = useParams();
  const query = useInfiniteQuery({
    queryKey: [kind, username],
    queryFn: ({ pageParam }) => api.page(`/users/${username}/${kind}`, { cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: nextCursor,
  });
  const users = flattenPages(query.data);
  return (
    <div>
      <PageHeader back title={`@${username}`} />
      <nav className="mb-4 flex gap-2 px-4 xs:px-0" aria-label="Connections">
        {['followers', 'following'].map((k) => (
          <Link key={k} to={`/u/${username}/${k}`} aria-current={k === kind ? 'page' : undefined} className={clsx('rounded-full px-4 py-1.5 text-sm font-semibold capitalize', k === kind ? 'bg-rose' : 'bg-surface text-muted hover:bg-blush/50')}>
            {k}
          </Link>
        ))}
      </nav>
      <div className="card p-5">
        {query.isPending && <UserRowSkeleton count={6} />}
        {query.isError && <ErrorState error={query.error} onRetry={query.refetch} />}
        {query.isSuccess && users.length === 0 && (
          <EmptyState icon={Users} title={kind === 'followers' ? 'No followers yet' : 'Not following anyone yet'} />
        )}
        <div className="space-y-4">
          {users.map((u) => (
            <UserCard key={u._id} user={u} />
          ))}
        </div>
        <InfiniteSentinel query={query} />
      </div>
    </div>
  );
}
