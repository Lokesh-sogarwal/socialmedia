import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Hash } from 'lucide-react';
import { api } from '../../lib/api.js';
import { plural } from '../../lib/format.js';
import { UserCard } from '../users/UserCard.jsx';
import { UserRowSkeleton } from '../ui/SkeletonLoader.jsx';

export function SuggestedAccounts({ limit = 5, title = 'Suggested for you' }) {
  const query = useQuery({ queryKey: ['suggestions', limit], queryFn: () => api.get('/users/suggestions', { limit }) });
  if (query.isSuccess && query.data.length === 0) return null;
  return (
    <section aria-labelledby="suggested-heading" className="card p-5">
      <h2 id="suggested-heading" className="mb-4 text-sm font-semibold text-muted">
        {title}
      </h2>
      {query.isPending && <UserRowSkeleton />}
      {query.isError && <p className="text-sm text-muted">Suggestions are unavailable right now.</p>}
      <div className="space-y-4">
        {query.data?.map((u) => (
          <UserCard key={u._id} user={u} subtitle={u.mutuals ? `Followed by ${u.mutuals} you follow` : `@${u.username}`} />
        ))}
      </div>
    </section>
  );
}

export function TrendingHashtags() {
  const query = useQuery({ queryKey: ['trending'], queryFn: () => api.get('/hashtags/trending'), staleTime: 5 * 60_000 });
  return (
    <section aria-labelledby="trending-heading" className="card p-5">
      <h2 id="trending-heading" className="mb-3 text-sm font-semibold text-muted">
        Trending this week
      </h2>
      {query.isPending && <UserRowSkeleton count={2} />}
      {query.isSuccess && query.data.length === 0 && <p className="text-sm text-muted">No trending tags yet — start one with a #hashtag.</p>}
      <ul className="space-y-1">
        {query.data?.map((t) => (
          <li key={t.tag}>
            <Link to={`/explore/tags/${encodeURIComponent(t.tag)}`} className="flex items-center gap-3 rounded-control px-2 py-2 hover:bg-blush/40">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blush/70">
                <Hash className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">#{t.tag}</span>
                <span className="block text-xs text-muted">{plural(t.posts, 'post')}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RightRail() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-rail shrink-0 space-y-5 overflow-y-auto py-6 pr-6 xl:block" aria-label="Discover">
      <SuggestedAccounts />
      <TrendingHashtags />
      <p className="px-2 text-xs text-muted">© {new Date().getFullYear()} Socio</p>
    </aside>
  );
}
