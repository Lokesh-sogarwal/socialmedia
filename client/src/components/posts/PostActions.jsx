import { useState } from 'react';
import { Link } from 'react-router';
import clsx from 'clsx';
import { Bookmark, Heart, MessageCircle, Send } from 'lucide-react';
import { usePostMutations } from '../../hooks/usePostMutations.js';
import { useToast } from '../../context/ToastContext.jsx';
import { plural } from '../../lib/format.js';
import { LikersModal } from './LikersModal.jsx';

export function PostActions({ post, onComment }) {
  const { like, bookmark } = usePostMutations(post);
  const toast = useToast();
  const [showLikers, setShowLikers] = useState(false);

  async function share() {
    const url = `${window.location.origin}/p/${post._id}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Socio post', url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied');
      }
    } catch {
      // user dismissed the share sheet
    }
  }

  return (
    <div className="px-3 pt-2">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => like.mutate(!post.likedByMe)}
          aria-pressed={post.likedByMe}
          aria-label={post.likedByMe ? 'Unlike' : 'Like'}
          className="rounded-full p-2 transition hover:bg-blush/60"
        >
          <Heart className={clsx('h-6 w-6 transition', post.likedByMe ? 'fill-rose stroke-rose-deep' : 'stroke-charcoal')} />
        </button>
        {onComment ? (
          <button type="button" onClick={onComment} aria-label="Comment" className="rounded-full p-2 hover:bg-blush/60">
            <MessageCircle className="h-6 w-6" />
          </button>
        ) : (
          <Link to={`/p/${post._id}`} aria-label="View comments" className="rounded-full p-2 hover:bg-blush/60">
            <MessageCircle className="h-6 w-6" />
          </Link>
        )}
        <button type="button" onClick={share} aria-label="Share" className="rounded-full p-2 hover:bg-blush/60">
          <Send className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={() => bookmark.mutate(!post.bookmarkedByMe)}
          aria-pressed={post.bookmarkedByMe}
          aria-label={post.bookmarkedByMe ? 'Remove from saved' : 'Save'}
          className="ml-auto rounded-full p-2 hover:bg-blush/60"
        >
          <Bookmark className={clsx('h-6 w-6', post.bookmarkedByMe && 'fill-charcoal')} />
        </button>
      </div>
      <div className="px-2 text-sm font-semibold">
        {post.likesCount > 0 ? (
          <button type="button" className="hover:underline" onClick={() => setShowLikers(true)}>
            {plural(post.likesCount, 'like')}
          </button>
        ) : (
          <span className="font-normal text-muted">Be the first to like this</span>
        )}
      </div>
      {showLikers && <LikersModal postId={post._id} onClose={() => setShowLikers(false)} />}
    </div>
  );
}
