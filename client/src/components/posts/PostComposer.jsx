import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Smile, X } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { UserAvatar } from '../users/UserAvatar.jsx';
import { api } from '../../lib/api.js';
import { updatePostEverywhere } from '../../lib/cache.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const MAX_FILES = 10;
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime';
const EMOJIS = ['😀', '😊', '❤️', '😎', '😂', '✨', '🌸', '🔥'];
const CAPTION_MAX = 2200;

function validateFiles(files, existing) {
  const all = [...existing, ...files];
  if (all.length > MAX_FILES) return `You can add up to ${MAX_FILES} files`;
  if (all.filter((f) => f.type.startsWith('video/')).length > 1) return 'A post can include one video';
  for (const f of files) {
    if (!ACCEPT.split(',').includes(f.type)) return `${f.name} isn’t a supported photo or video`;
    if (f.type.startsWith('image/') && f.size > MAX_IMAGE) return `${f.name} is larger than 10 MB`;
    if (f.type.startsWith('video/') && f.size > MAX_VIDEO) return `${f.name} is larger than 50 MB`;
  }
  return null;
}

/** Create a post (caption + up to 10 photos or one video) or edit an existing caption. */
export default function PostComposer({ post, onClose }) {
  const editing = Boolean(post);
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [caption, setCaption] = useState(post?.caption ?? '');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const textRef = useRef(null);

  const previews = useMemo(() => files.map((f) => ({ file: f, url: URL.createObjectURL(f) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const mutation = useMutation({
    mutationFn: () => {
      if (editing) return api.patch(`/posts/${post._id}`, { caption });
      const form = new FormData();
      form.append('caption', caption);
      files.forEach((f) => form.append('media', f));
      return api.post('/posts', form);
    },
    onSuccess: (saved) => {
      if (editing) {
        updatePostEverywhere(qc, saved._id, () => saved);
        toast.success('Post updated');
      } else {
        qc.setQueryData(['feed', 'home'], (data) =>
          data?.pages ? { ...data, pages: data.pages.map((p, i) => (i === 0 ? { ...p, data: [saved, ...p.data] } : p)) } : data,
        );
        qc.invalidateQueries({ queryKey: ['userPosts'] });
        qc.invalidateQueries({ queryKey: ['profile'] });
        qc.invalidateQueries({ queryKey: ['trending'] });
        toast.success('Your post is live');
      }
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  function addFiles(list) {
    const incoming = [...list];
    const problem = validateFiles(incoming, files);
    if (problem) return setError(problem);
    setError('');
    setFiles((f) => [...f, ...incoming]);
    return undefined;
  }

  function insertEmoji(emoji) {
    const el = textRef.current;
    const start = el?.selectionStart ?? caption.length;
    const end = el?.selectionEnd ?? caption.length;
    const next = caption.slice(0, start) + emoji + caption.slice(end);
    if (next.length > CAPTION_MAX) return;
    setCaption(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  const canSubmit = editing ? caption.trim() || post.media.length : caption.trim() || files.length;

  return (
    <Modal title={editing ? 'Edit post' : 'Create post'} onClose={() => !mutation.isPending && onClose()} size="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) mutation.mutate();
        }}
        className="flex flex-col"
      >
        <div className="flex gap-3 p-5">
          <UserAvatar user={user} size="md" />
          <div className="min-w-0 flex-1">
            <label htmlFor="composer-caption" className="sr-only">
              Caption
            </label>
            <textarea
              id="composer-caption"
              ref={textRef}
              data-autofocus
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX))}
              placeholder="Share something… use #hashtags and @mentions"
              rows={4}
              className="w-full resize-none border-0 bg-transparent p-0 text-base placeholder:text-muted/80 focus:outline-none focus:ring-0"
            />
            <div className="mt-1 flex items-center gap-1" aria-label="Insert emoji">
              <Smile className="mr-1 h-4 w-4 text-muted" aria-hidden />
              {EMOJIS.map((e) => (
                <button key={e} type="button" onClick={() => insertEmoji(e)} className="rounded-md px-1 text-lg hover:bg-blush/60" aria-label={`Insert ${e}`}>
                  {e}
                </button>
              ))}
              <span className="ml-auto text-xs text-muted">
                {caption.length}/{CAPTION_MAX}
              </span>
            </div>
          </div>
        </div>

        {editing && post.media.length > 0 && (
          <p className="px-5 pb-3 text-xs text-muted">Photos and videos can’t be changed after posting.</p>
        )}

        {!editing && (
          <div className="px-5 pb-2">
            {previews.length > 0 && (
              <ul className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {previews.map((p, i) => (
                  <li key={p.url} className="relative aspect-square overflow-hidden rounded-control bg-blush/40">
                    {p.file.type.startsWith('video/') ? (
                      <video src={p.url} className="h-full w-full object-cover" muted />
                    ) : (
                      <img src={p.url} alt={`Selected ${i + 1}`} className="h-full w-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => setFiles((f) => f.filter((_, j) => j !== i))}
                      className="absolute right-1 top-1 rounded-full bg-charcoal/75 p-1 text-surface hover:bg-charcoal"
                      aria-label={`Remove ${p.file.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addFiles(e.dataTransfer.files);
              }}
              className="flex flex-col items-center justify-center rounded-card border-2 border-dashed border-rose/70 bg-background px-4 py-6 text-center"
            >
              <ImagePlus className="h-7 w-7 text-rose-deep" aria-hidden />
              <p className="mt-2 text-sm font-medium">Drag photos or a video here</p>
              <p className="text-xs text-muted">JPG, PNG, WebP, GIF up to 10 MB · MP4, WebM, MOV up to 50 MB</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => inputRef.current?.click()}>
                Choose from device
              </Button>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPT}
                className="sr-only"
                aria-label="Add photos or video"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="px-5 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="mt-2 flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending} disabled={!canSubmit}>
            {editing ? 'Save' : 'Share'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
