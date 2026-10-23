import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Flag, Heart, MessageCircle, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import { api } from '../../lib/api.js';
import { flattenPages, nextCursor, updatePostEverywhere } from '../../lib/cache.js';
import { timeAgo, fullDate, compactNumber } from '../../lib/format.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { UserAvatar } from '../users/UserAvatar.jsx';
import { RichText } from '../RichText.jsx';
import { DropdownMenu } from '../ui/DropdownMenu.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { ReportDialog } from '../ReportDialog.jsx';
import { Button } from '../ui/Button.jsx';
import { UserRowSkeleton } from '../ui/SkeletonLoader.jsx';
import { EmptyState, ErrorState } from '../ui/States.jsx';
import { InfiniteSentinel } from '../ui/InfiniteSentinel.jsx';

const commentsKey = (postId, parent) => ['comments', postId, parent ?? 'root'];

function useComments(postId, parent, enabled = true) {
  return useInfiniteQuery({
    queryKey: commentsKey(postId, parent),
    queryFn: ({ pageParam }) => api.page(`/posts/${postId}/comments`, { cursor: pageParam, parent, limit: parent ? 10 : 20 }),
    initialPageParam: undefined,
    getNextPageParam: nextCursor,
    enabled,
  });
}

function patchComment(qc, postId, commentId, patch) {
  qc.setQueriesData({ queryKey: ['comments', postId] }, (data) =>
    data?.pages
      ? { ...data, pages: data.pages.map((p) => ({ ...p, data: p.data.map((c) => (c._id === commentId ? { ...c, ...patch(c) } : c)) })) }
      : data,
  );
}

function CommentItem({ comment, post, onReply }) {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [confirming, setConfirming] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const isMine = me?._id === comment.author._id;
  const canDelete = isMine || me?._id === post.author._id || ['moderator', 'admin'].includes(me?.role);
  const replies = useComments(post._id, comment._id, showReplies && !comment.parent);

  const like = useMutation({
    mutationFn: (liked) => (liked ? api.post(`/comments/${comment._id}/like`) : api.delete(`/comments/${comment._id}/like`)),
    onMutate: (liked) => {
      patchComment(qc, post._id, comment._id, (c) => ({ likedByMe: liked, likesCount: Math.max(0, c.likesCount + (liked ? 1 : -1)) }));
    },
    onError: (err, liked) => {
      patchComment(qc, post._id, comment._id, (c) => ({ likedByMe: !liked, likesCount: Math.max(0, c.likesCount + (liked ? -1 : 1)) }));
      toast.error(err.message);
    },
    onSuccess: (data) => patchComment(qc, post._id, comment._id, () => ({ likedByMe: data.liked, likesCount: data.likesCount })),
  });

  const edit = useMutation({
    mutationFn: () => api.patch(`/comments/${comment._id}`, { body: draft }),
    onSuccess: (updated) => {
      patchComment(qc, post._id, comment._id, () => updated);
      setEditing(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/comments/${comment._id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', post._id] });
      qc.invalidateQueries({ queryKey: ['post', post._id] });
      updatePostEverywhere(qc, post._id, (p) => ({ commentsCount: Math.max(0, p.commentsCount - 1 - (comment.parent ? 0 : comment.repliesCount)) }));
      setConfirming(false);
      toast.success('Comment deleted');
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <li className="flex gap-3">
      <Link to={`/u/${comment.author.username}`} className="shrink-0">
        <UserAvatar user={comment.author} size={comment.parent ? 'xs' : 'sm'} />
      </Link>
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) edit.mutate();
            }}
            className="space-y-2"
          >
            <label htmlFor={`edit-${comment._id}`} className="sr-only">
              Edit comment
            </label>
            <textarea id={`edit-${comment._id}`} className="input min-h-[3.5rem] text-sm" value={draft} maxLength={1000} onChange={(e) => setDraft(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={edit.isPending} disabled={!draft.trim()}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <p className="whitespace-pre-line break-words text-sm">
            <Link to={`/u/${comment.author.username}`} className="mr-1.5 font-semibold">
              {comment.author.username}
            </Link>
            <RichText text={comment.body} />
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <time dateTime={comment.createdAt} title={fullDate(comment.createdAt)}>
            {timeAgo(comment.createdAt)}
          </time>
          {comment.editedAt && <span>edited</span>}
          {comment.likesCount > 0 && <span>{compactNumber(comment.likesCount)} {comment.likesCount === 1 ? 'like' : 'likes'}</span>}
          <button type="button" className="font-semibold hover:text-charcoal" onClick={() => onReply(comment)}>
            Reply
          </button>
        </div>
        {!comment.parent && comment.repliesCount > 0 && (
          <div className="mt-2">
            <button type="button" onClick={() => setShowReplies((s) => !s)} className="flex items-center gap-2 text-xs font-semibold text-muted hover:text-charcoal" aria-expanded={showReplies}>
              <span className="h-px w-6 bg-line" aria-hidden />
              {showReplies ? 'Hide replies' : `View ${comment.repliesCount === 1 ? '1 reply' : `${comment.repliesCount} replies`}`}
            </button>
            {showReplies && (
              <ul className="mt-3 space-y-4">
                {replies.isPending && <UserRowSkeleton count={1} />}
                {flattenPages(replies.data).map((r) => (
                  <CommentItem key={r._id} comment={r} post={post} onReply={onReply} />
                ))}
                {replies.hasNextPage && (
                  <button type="button" className="text-xs font-semibold text-muted hover:text-charcoal" onClick={() => replies.fetchNextPage()}>
                    More replies
                  </button>
                )}
              </ul>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-center">
        <button
          type="button"
          onClick={() => like.mutate(!comment.likedByMe)}
          aria-pressed={comment.likedByMe}
          aria-label={comment.likedByMe ? 'Unlike comment' : 'Like comment'}
          className="rounded-full p-1.5 hover:bg-blush/60"
        >
          <Heart className={clsx('h-4 w-4', comment.likedByMe ? 'fill-rose stroke-rose-deep' : 'stroke-muted')} />
        </button>
        <DropdownMenu
          label="Comment options"
          trigger={<MoreHorizontal className="h-4 w-4 text-muted" />}
          items={[
            isMine && { label: 'Edit', icon: Pencil, onSelect: () => setEditing(true) },
            canDelete && { label: 'Delete', icon: Trash2, danger: true, onSelect: () => setConfirming(true) },
            !isMine && { label: 'Report', icon: Flag, danger: true, onSelect: () => setReporting(true) },
          ]}
        />
      </div>
      {confirming && (
        <ConfirmDialog
          title="Delete comment?"
          description={!comment.parent && comment.repliesCount ? 'Its replies will be deleted too.' : 'This can’t be undone.'}
          confirmLabel="Delete"
          loading={remove.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={() => remove.mutate()}
        />
      )}
      {reporting && <ReportDialog targetType="comment" target={comment._id} onClose={() => setReporting(false)} />}
    </li>
  );
}

export const CommentForm = forwardRef(function CommentForm({ post, replyTo, onCancelReply }, ref) {
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const [body, setBody] = useState('');
  const inputRef = useRef(null);
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));

  const create = useMutation({
    mutationFn: () => api.post(`/posts/${post._id}/comments`, { body, parent: replyTo?._id }),
    onSuccess: (comment) => {
      setBody('');
      onCancelReply?.();
      if (comment.parent) {
        patchComment(qc, post._id, comment.parent, (c) => ({ repliesCount: c.repliesCount + 1 }));
        qc.invalidateQueries({ queryKey: commentsKey(post._id, comment.parent) });
      } else {
        qc.setQueryData(commentsKey(post._id), (data) =>
          data?.pages ? { ...data, pages: data.pages.map((p, i) => (i === 0 ? { ...p, data: [comment, ...p.data] } : p)) } : data,
        );
      }
      updatePostEverywhere(qc, post._id, (p) => ({ commentsCount: p.commentsCount + 1 }));
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) create.mutate();
      }}
      className="border-t border-line bg-surface"
    >
      {replyTo && (
        <div className="flex items-center justify-between bg-background px-4 py-1.5 text-xs text-muted">
          <span>
            Replying to <strong className="text-charcoal">@{replyTo.author.username}</strong>
          </span>
          <button type="button" onClick={onCancelReply} aria-label="Cancel reply" className="rounded p-1 hover:bg-blush/60">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-3 px-4 py-3">
        <UserAvatar user={user} size="sm" />
        <label htmlFor={`comment-${post._id}`} className="sr-only">
          Add a comment
        </label>
        <input
          id={`comment-${post._id}`}
          ref={inputRef}
          value={body}
          maxLength={1000}
          onChange={(e) => setBody(e.target.value)}
          placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'}
          className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted/80 focus:outline-none"
        />
        <Button type="submit" size="sm" variant="ghost" disabled={!body.trim()} loading={create.isPending}>
          Post
        </Button>
      </div>
    </form>
  );
});

export function CommentSection({ post, formRef }) {
  const [replyTo, setReplyTo] = useState(null);
  const query = useComments(post._id);
  const comments = flattenPages(query.data);

  function reply(comment) {
    setReplyTo(comment);
    formRef?.current?.focus();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {query.isPending && <UserRowSkeleton count={4} />}
        {query.isError && <ErrorState error={query.error} onRetry={query.refetch} />}
        {query.isSuccess && comments.length === 0 && (
          <EmptyState icon={MessageCircle} title="No comments yet" description="Start the conversation." />
        )}
        <ul className="space-y-5">
          {comments.map((c) => (
            <CommentItem key={c._id} comment={c} post={post} onReply={reply} />
          ))}
        </ul>
        <InfiniteSentinel query={query} />
      </div>
      <CommentForm ref={formRef} post={post} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
    </div>
  );
}
