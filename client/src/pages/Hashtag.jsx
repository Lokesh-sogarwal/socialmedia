import { useParams } from 'react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Hash } from 'lucide-react';
import { api } from '../lib/api.js';
import { nextCursor } from '../lib/cache.js';
import { compactNumber } from '../lib/format.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { PostList } from '../components/posts/PostList.jsx';
import { EmptyState } from '../components/ui/States.jsx';

export default function Hashtag() {
  const { tag } = useParams();
  const query = useInfiniteQuery({
    queryKey: ['hashtag', tag],
    queryFn: ({ pageParam }) => api.page(`/hashtags/${encodeURIComponent(tag)}/posts`, { cursor: pageParam, limit: 10 }),
    initialPageParam: undefined,
    getNextPageParam: nextCursor,
  });
  const total = query.data?.pages[0]?.meta?.total;
  return (
    <div>
      <PageHeader back title={`#${tag}`} subtitle={total !== undefined ? `${compactNumber(total)} ${total === 1 ? 'post' : 'posts'}` : undefined} />
      <PostList
        query={query}
        endLabel="That’s every post with this tag"
        empty={
          <div className="card">
            <EmptyState icon={Hash} title={`No posts tagged #${tag} yet`} description="Be the first — add the tag to your next post." />
          </div>
        }
      />
    </div>
  );
}
