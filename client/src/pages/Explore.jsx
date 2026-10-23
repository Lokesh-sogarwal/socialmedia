import { Link } from 'react-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Clapperboard, Compass, Hash, Search } from 'lucide-react';
import { api } from '../lib/api.js';
import { nextCursor } from '../lib/cache.js';
import { PostGrid } from '../components/posts/PostGrid.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { EmptyState } from '../components/ui/States.jsx';
import { SuggestedAccounts } from '../components/layout/RightRail.jsx';

export default function Explore() {
  const query = useInfiniteQuery({
    queryKey: ['feed', 'explore'],
    queryFn: ({ pageParam }) => api.page('/feed/explore', { cursor: pageParam, limit: 24 }),
    initialPageParam: undefined,
    getNextPageParam: nextCursor,
  });
  const trending = useQuery({ queryKey: ['trending'], queryFn: () => api.get('/hashtags/trending'), staleTime: 5 * 60_000 });

  return (
    <div>
      <PageHeader title="Explore" subtitle="Fresh photos and videos from across Socio" />
      <div className="mb-5 flex flex-wrap gap-2 px-4 xs:px-0">
        <Link to="/search" className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-blush/40">
          <Search className="h-4 w-4" aria-hidden /> Search people & tags
        </Link>
        <Link to="/reels" className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-blush/40">
          <Clapperboard className="h-4 w-4" aria-hidden /> Reels
        </Link>
        {trending.data?.slice(0, 6).map((t) => (
          <Link key={t.tag} to={`/explore/tags/${encodeURIComponent(t.tag)}`} className="inline-flex items-center gap-1 rounded-full bg-blush/70 px-4 py-2 text-sm font-medium hover:bg-blush">
            <Hash className="h-3.5 w-3.5" aria-hidden />
            {t.tag}
          </Link>
        ))}
      </div>
      <div className="px-1 xs:px-0">
        <PostGrid
          query={query}
          empty={
            <div className="space-y-5">
              <div className="card">
                <EmptyState icon={Compass} title="Nothing to explore yet" description="When people share public photos and videos, they’ll show up here." />
              </div>
              <SuggestedAccounts />
            </div>
          }
        />
      </div>
    </div>
  );
}
