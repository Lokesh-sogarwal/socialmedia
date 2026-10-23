import { Link } from 'react-router';
import { Copy, Heart, MessageCircle, Play } from 'lucide-react';
import { GridSkeleton } from '../ui/SkeletonLoader.jsx';
import { ErrorState } from '../ui/States.jsx';
import { InfiniteSentinel } from '../ui/InfiniteSentinel.jsx';
import { flattenPages } from '../../lib/cache.js';
import { compactNumber } from '../../lib/format.js';

function Tile({ post }) {
  const cover = post.media[0];
  return (
    <Link to={`/p/${post._id}`} className="group relative block aspect-square overflow-hidden rounded-md bg-blush/50 sm:rounded-control" aria-label={`Open post${post.caption ? `: ${post.caption.slice(0, 60)}` : ''}`}>
      {cover ? (
        cover.type === 'video' ? (
          <video src={`${cover.url}#t=0.1`} preload="metadata" muted className="h-full w-full object-cover" />
        ) : (
          <img src={cover.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        )
      ) : (
        <p className="line-clamp-6 h-full w-full overflow-hidden bg-blush p-3 text-sm">{post.caption}</p>
      )}
      {post.media.length > 1 && <Copy className="absolute right-2 top-2 h-4 w-4 text-surface drop-shadow" aria-hidden />}
      {post.hasVideo && <Play className="absolute right-2 top-2 h-4 w-4 fill-surface text-surface drop-shadow" aria-hidden />}
      <div className="absolute inset-0 hidden items-center justify-center gap-5 bg-charcoal/40 text-sm font-semibold text-surface group-hover:flex" aria-hidden>
        <span className="flex items-center gap-1.5">
          <Heart className="h-5 w-5 fill-surface" /> {compactNumber(post.likesCount)}
        </span>
        <span className="flex items-center gap-1.5">
          <MessageCircle className="h-5 w-5 fill-surface" /> {compactNumber(post.commentsCount)}
        </span>
      </div>
    </Link>
  );
}

export function PostGrid({ query, empty }) {
  if (query.isPending) return <GridSkeleton />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const posts = flattenPages(query.data);
  if (!posts.length) return empty;
  return (
    <>
      <div className="grid grid-cols-3 gap-1 sm:gap-2">
        {posts.map((p) => (
          <Tile key={p._id} post={p} />
        ))}
      </div>
      <InfiniteSentinel query={query} />
    </>
  );
}
