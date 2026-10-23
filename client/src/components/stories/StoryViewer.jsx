import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Eye, Pause, Play, Trash2, X } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { Spinner } from '../ui/Spinner.jsx';
import { UserAvatar } from '../users/UserAvatar.jsx';
import { api } from '../../lib/api.js';
import { timeAgo } from '../../lib/format.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const IMAGE_MS = 5000;

function ViewersList({ storyId }) {
  const query = useQuery({ queryKey: ['storyViewers', storyId], queryFn: () => api.get(`/stories/${storyId}/viewers`) });
  if (query.isPending) return <Spinner />;
  if (!query.data?.length) return <p className="text-sm text-muted">No views yet.</p>;
  return (
    <ul className="max-h-64 space-y-3 overflow-y-auto">
      {query.data.map((v) => (
        <li key={v.user._id} className="flex items-center gap-3">
          <UserAvatar user={v.user} size="sm" />
          <span className="flex-1 text-sm font-semibold">{v.user.username}</span>
          <span className="text-xs text-muted">{timeAgo(v.viewedAt)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Full-screen story player across several authors, with tap/keyboard navigation. */
export function StoryViewer({ authors, startIndex = 0, onClose }) {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [authorIndex, setAuthorIndex] = useState(startIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const videoRef = useRef(null);
  const author = authors[authorIndex];

  const query = useQuery({ queryKey: ['stories', 'user', author?._id], queryFn: () => api.get(`/stories/user/${author._id}`), enabled: Boolean(author) });
  const stories = query.data?.stories ?? [];
  const story = stories[storyIndex];
  const isMine = author?._id === me._id;

  // Start each author at their first unseen story.
  useEffect(() => {
    if (!query.data) return;
    const firstUnseen = query.data.stories.findIndex((s) => !s.seen);
    setStoryIndex(isMine || firstUnseen < 0 ? 0 : firstUnseen);
  }, [query.data, isMine]);

  const markSeen = useMutation({ mutationFn: (id) => api.post(`/stories/${id}/view`) });
  useEffect(() => {
    if (story && !isMine && !story.seen) markSeen.mutate(story._id);
    setProgress(0);
  }, [story?._id]);

  const next = useCallback(() => {
    if (storyIndex < stories.length - 1) setStoryIndex((i) => i + 1);
    else if (authorIndex < authors.length - 1) {
      setAuthorIndex((i) => i + 1);
      setStoryIndex(0);
    } else onClose();
  }, [storyIndex, stories.length, authorIndex, authors.length, onClose]);

  const prev = useCallback(() => {
    if (storyIndex > 0) setStoryIndex((i) => i - 1);
    else if (authorIndex > 0) {
      setAuthorIndex((i) => i - 1);
      setStoryIndex(0);
    }
  }, [storyIndex, authorIndex]);

  // Image timer; videos advance on `ended`.
  useEffect(() => {
    if (!story || story.media.type === 'video' || paused || showViewers) return undefined;
    const started = Date.now() - progress * IMAGE_MS;
    const t = setInterval(() => {
      const p = (Date.now() - started) / IMAGE_MS;
      if (p >= 1) {
        clearInterval(t);
        next();
      } else setProgress(p);
    }, 50);
    return () => clearInterval(t);
  }, [story?._id, paused, showViewers, next]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused || showViewers) v.pause();
    else v.play().catch(() => {});
  }, [paused, showViewers, story?._id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const remove = useMutation({
    mutationFn: () => api.delete(`/stories/${story._id}`),
    onSuccess: async () => {
      toast.success('Story deleted');
      await qc.invalidateQueries({ queryKey: ['stories'] });
      if (stories.length <= 1) onClose();
      else setStoryIndex((i) => Math.max(0, i - 1));
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    // Invalidate the tray on close so "seen" rings update.
    return () => qc.invalidateQueries({ queryKey: ['stories', 'feed'] });
  }, [qc]);

  return (
    <Modal title={`${author?.displayName ?? ''} story`} onClose={onClose} size="full" bare className="h-dvh max-h-dvh sm:h-[92dvh] sm:max-w-[min(92vw,30rem)] sm:rounded-card">
      <div className="relative flex h-full flex-col bg-charcoal text-surface">
        <div className="absolute inset-x-0 top-0 z-10 space-y-3 bg-gradient-to-b from-charcoal/70 to-transparent p-3">
          <div className="flex gap-1" aria-hidden>
            {stories.map((s, i) => (
              <span key={s._id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-surface/35">
                <span className="block h-full bg-surface" style={{ width: `${i < storyIndex ? 100 : i === storyIndex ? progress * 100 : 0}%` }} />
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link to={`/u/${author?.username}`} onClick={onClose} className="flex items-center gap-2">
              <UserAvatar user={author} size="sm" />
              <span className="text-sm font-semibold">{author?.username}</span>
            </Link>
            {story && <span className="text-xs text-surface/75">{timeAgo(story.createdAt)}</span>}
            <div className="ml-auto flex items-center gap-1">
              <button type="button" onClick={() => setPaused((p) => !p)} className="rounded-full p-2 hover:bg-surface/15" aria-label={paused ? 'Play' : 'Pause'}>
                {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </button>
              <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-surface/15" aria-label="Close stories">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          {query.isPending && <Spinner className="text-surface" />}
          {query.isError && <p className="px-6 text-center text-sm">These stories are no longer available.</p>}
          {story &&
            (story.media.type === 'video' ? (
              <video ref={videoRef} key={story._id} src={story.media.url} className="h-full w-full object-contain" playsInline autoPlay onEnded={next} onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1))} />
            ) : (
              <img key={story._id} src={story.media.url} alt={story.caption || `Story by ${author.username}`} className="h-full w-full object-contain" />
            ))}
          <button type="button" className="absolute inset-y-0 left-0 w-1/3" onClick={prev} aria-label="Previous story" />
          <button type="button" className="absolute inset-y-0 right-0 w-1/3" onClick={next} aria-label="Next story" />
          <ChevronLeft className="pointer-events-none absolute left-2 hidden h-6 w-6 opacity-70 sm:block" aria-hidden />
          <ChevronRight className="pointer-events-none absolute right-2 hidden h-6 w-6 opacity-70 sm:block" aria-hidden />
        </div>

        {(story?.caption || isMine) && (
          <div className="space-y-3 bg-gradient-to-t from-charcoal/80 to-transparent p-4">
            {story?.caption && <p className="text-center text-sm">{story.caption}</p>}
            {isMine && story && (
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setShowViewers((s) => !s)} className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm hover:bg-surface/15" aria-expanded={showViewers}>
                  <Eye className="h-4 w-4" aria-hidden /> {story.viewsCount ?? 0} {story.viewsCount === 1 ? 'view' : 'views'}
                </button>
                <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm hover:bg-surface/15">
                  <Trash2 className="h-4 w-4" aria-hidden /> Delete
                </button>
              </div>
            )}
            {showViewers && story && (
              <div className="rounded-card bg-surface p-4 text-charcoal">
                <ViewersList storyId={story._id} />
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
