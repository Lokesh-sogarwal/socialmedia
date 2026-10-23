import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Flag, Link2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { UserAvatar } from '../users/UserAvatar.jsx';
import { DropdownMenu } from '../ui/DropdownMenu.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { ReportDialog } from '../ReportDialog.jsx';
import { RichText } from '../RichText.jsx';
import { MediaCarousel } from './MediaCarousel.jsx';
import { PostActions } from './PostActions.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useComposer } from '../../context/ComposerContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { usePostMutations } from '../../hooks/usePostMutations.js';
import { fullDate, plural, timeAgo } from '../../lib/format.js';

export function PostHeader({ post, onDeleted }) {
  const { user: me } = useAuth();
  const { openPost } = useComposer();
  const toast = useToast();
  const { remove } = usePostMutations(post);
  const [confirm, setConfirm] = useState(false);
  const [reporting, setReporting] = useState(false);
  const isMine = me?._id === post.author._id;
  const canModerate = ['moderator', 'admin'].includes(me?.role);

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Link to={`/u/${post.author.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <UserAvatar user={post.author} size="sm" />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold">{post.author.displayName}</p>
          <p className="truncate text-xs text-muted">
            @{post.author.username} ·{' '}
            <time dateTime={post.createdAt} title={fullDate(post.createdAt)}>
              {timeAgo(post.createdAt)}
            </time>
            {post.editedAt && ' · edited'}
          </p>
        </div>
      </Link>
      <DropdownMenu
        label="Post options"
        trigger={<MoreHorizontal className="h-5 w-5" />}
        items={[
          isMine && { label: 'Edit caption', icon: Pencil, onSelect: () => openPost(post) },
          (isMine || canModerate) && { label: 'Delete post', icon: Trash2, danger: true, onSelect: () => setConfirm(true) },
          {
            label: 'Copy link',
            icon: Link2,
            onSelect: () =>
              navigator.clipboard
                .writeText(`${window.location.origin}/p/${post._id}`)
                .then(() => toast.success('Link copied'))
                .catch(() => toast.error('Could not copy link')),
          },
          !isMine && { label: 'Report post', icon: Flag, danger: true, onSelect: () => setReporting(true) },
        ]}
      />
      {confirm && (
        <ConfirmDialog
          title="Delete this post?"
          description="This removes the post, its comments and likes. This can’t be undone."
          confirmLabel="Delete"
          loading={remove.isPending}
          onCancel={() => setConfirm(false)}
          onConfirm={() =>
            remove.mutate(undefined, {
              onSuccess: () => {
                setConfirm(false);
                onDeleted?.();
              },
            })
          }
        />
      )}
      {reporting && <ReportDialog targetType="post" target={post._id} onClose={() => setReporting(false)} />}
    </div>
  );
}

export function PostCard({ post }) {
  const navigate = useNavigate();
  const { like } = usePostMutations(post);
  const [expanded, setExpanded] = useState(false);
  const long = post.caption.length > 220;

  return (
    <article className="card overflow-hidden" aria-label={`Post by ${post.author.displayName}`}>
      <PostHeader post={post} />
      {post.media.length > 0 && <MediaCarousel media={post.media} onDoubleClick={() => !post.likedByMe && like.mutate(true)} />}
      <PostActions post={post} />
      <div className="px-5 pb-4 pt-1.5 text-[15px]">
        {post.caption && (
          <p className="whitespace-pre-line break-words">
            <Link to={`/u/${post.author.username}`} className="mr-1.5 font-semibold">
              {post.author.username}
            </Link>
            <RichText text={long && !expanded ? `${post.caption.slice(0, 220).trimEnd()}…` : post.caption} />
            {long && !expanded && (
              <button type="button" onClick={() => setExpanded(true)} className="ml-1 text-sm text-muted hover:underline">
                more
              </button>
            )}
          </p>
        )}
        {post.commentsCount > 0 ? (
          <button type="button" onClick={() => navigate(`/p/${post._id}`)} className="mt-1.5 text-sm text-muted hover:underline">
            View {post.commentsCount === 1 ? '1 comment' : `all ${plural(post.commentsCount, 'comment')}`}
          </button>
        ) : (
          <Link to={`/p/${post._id}`} className="mt-1.5 inline-block text-sm text-muted hover:underline">
            Add a comment…
          </Link>
        )}
      </div>
    </article>
  );
}
