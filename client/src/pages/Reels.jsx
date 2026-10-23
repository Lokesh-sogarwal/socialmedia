import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Bookmark, Clapperboard, Heart, MessageCircle } from 'lucide-react';
import { api } from '../lib/api.js';
import { flattenPages, nextCursor } from '../lib/cache.js';
import { compactNumber } from '../lib/format.js';
import { usePostMutations } from '../hooks/usePostMutations.js';
import { UserAvatar } from '../components/users/UserAvatar.jsx';
import { RichText } from '../components/RichText.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { InfiniteSentinel } from '../components/ui/InfiniteSentinel.jsx';
import { Skeleton } from '../components/ui/SkeletonLoader.jsx';

function Reel({ post }) {
  const ref = useRef(null);
  const video = post.media.find((m) => m.type === 'video');
  const { like, bookmark } = usePostMutations(post);

  // Play only the reel that is mostly on screen.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(([entry]) => (entry.intersectionRatio > 0.6 ? el.play().catch(() => {}) : el.pause()), { threshold: [0, 0.6, 1] });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <article className="relative mx-auto flex h-[calc(100dvh-var(--height-mobile-nav)-3.5rem)] max-h-[52rem] w-full max-w-[28rem] snap-start snap-always items-center justify-center overflow-hidden bg-charcoal sm:rounded-card md:h-[calc(100dvh-4rem)]" aria-label={`Reel by ${post.author.username}`}>
      <video ref={ref} src={video.url} loop muted playsInline controls preload="metadata" className="h-full w-full object-contain" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-charcoal/85 to-transparent p-4 pr-16 text-surface">
        <Link to={`/u/${post.author.username}`} className="pointer-events-auto mb-2 flex items-center gap-2">
          <UserAvatar user={post.author} size="sm" />
          <span className="font-semibold">{post.author.username}</span>
        </Link>
        {post.caption && (
          <p className="pointer-events-auto line-clamp-3 text-sm [&_a]:text-surface">
            <RichText text={post.caption} />
          </p>
        )}
      </div>
      <div className="absolute bottom-24 right-2 flex flex-col items-center gap-4 text-surface">
        <button type="button" onClick={() => like.mutate(!post.likedByMe)} aria-pressed={post.likedByMe} aria-label={post.likedByMe ? 'Unlike' : 'Like'} className="flex flex-col items-center gap-1">
          <Heart className={clsx('h-7 w-7 drop-shadow', post.likedByMe && 'fill-rose stroke-rose')} />
          <span className="text-xs font-semibold">{compactNumber(post.likesCount)}</span>
        </button>
        <Link to={`/p/${post._id}`} className="flex flex-col items-center gap-1" aria-label="Comments">
          <MessageCircle className="h-7 w-7 drop-shadow" />
          <span className="text-xs font-semibold">{compactNumber(post.commentsCount)}</span>
        </Link>
        <button type="button" onClick={() => bookmark.mutate(!post.bookmarkedByMe)} aria-pressed={post.bookmarkedByMe} aria-label={post.bookmarkedByMe ? 'Remove from saved' : 'Save'}>
          <Bookmark className={clsx('h-7 w-7 drop-shadow', post.bookmarkedByMe && 'fill-surface')} />
        </button>
      </div>
    </article>
  );
}

export default function Reels() {
  const query = useInfiniteQuery({
    queryKey: ['feed', 'reels'],
    queryFn: ({ pageParam }) => api.page('/feed/reels', { cursor: pageParam, limit: 5 }),
    initialPageParam: undefined,
    getNextPageParam: nextCursor,
  });
  const reels = flattenPages(query.data);

  return (
    <div>
      <h1 className="sr-only">Reels</h1>
      {query.isPending && <Skeleton className="mx-auto h-[70dvh] w-full max-w-[28rem] rounded-card" />}
      {query.isError && <ErrorState error={query.error} onRetry={query.refetch} />}
      {query.isSuccess && reels.length === 0 && (
        <div className="card mx-auto max-w-lg">
          <EmptyState icon={Clapperboard} title="No reels yet" description="Short videos people share publicly will play here. Post a video to start." />
        </div>
      )}
      <div className="no-scrollbar mx-auto flex max-h-[calc(100dvh-var(--height-mobile-nav)-3.5rem)] snap-y snap-mandatory flex-col gap-4 overflow-y-auto md:max-h-[calc(100dvh-4rem)]">
        {reels.map((p) => (
          <Reel key={p._id} post={p} />
        ))}
        <InfiniteSentinel query={query} />
      </div>
    </div>
  );
}
