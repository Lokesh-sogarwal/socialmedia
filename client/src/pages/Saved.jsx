import { useInfiniteQuery } from '@tanstack/react-query';
import { Bookmark } from 'lucide-react';
import { api } from '../lib/api.js';
import { nextCursor } from '../lib/cache.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { PostGrid } from '../components/posts/PostGrid.jsx';
import { EmptyState } from '../components/ui/States.jsx';

export default function Saved() {
  const query = useInfiniteQuery({
    queryKey: ['bookmarks'],
    queryFn: ({ pageParam }) => api.page('/bookmarks', { cursor: pageParam, limit: 24 }),
    initialPageParam: undefined,
    getNextPageParam: nextCursor,
  });
  return (
    <div>
      <PageHeader title="Saved" subtitle="Only you can see what you’ve saved" />
      <div className="px-1 xs:px-0">
        <PostGrid
          query={query}
          empty={
            <div className="card">
              <EmptyState icon={Bookmark} title="Nothing saved yet" description="Tap the bookmark on any post to keep it here for later." />
            </div>
          }
        />
      </div>
    </div>
  );
}
