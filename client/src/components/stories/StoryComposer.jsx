import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { api } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function StoryComposer({ onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const mutation = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('media', file);
      form.append('caption', caption);
      return api.post('/stories', form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stories'] });
      toast.success('Story shared for 24 hours');
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  function pick(f) {
    if (!f) return;
    const isVideo = f.type.startsWith('video/');
    if (!/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime))$/.test(f.type)) return setError('Choose a photo or video');
    if (f.size > (isVideo ? 50 : 10) * 1024 * 1024) return setError(`That file is too large (max ${isVideo ? 50 : 10} MB)`);
    setError('');
    setFile(f);
    return undefined;
  }

  return (
    <Modal title="Add to your story" onClose={onClose} size="sm">
      <form
        className="space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (file) mutation.mutate();
        }}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[9/14] w-full items-center justify-center overflow-hidden rounded-card border-2 border-dashed border-rose/70 bg-background"
          data-autofocus
        >
          {preview ? (
            file.type.startsWith('video/') ? (
              <video src={preview} className="h-full w-full object-cover" muted autoPlay loop playsInline />
            ) : (
              <img src={preview} alt="Story preview" className="h-full w-full object-cover" />
            )
          ) : (
            <span className="flex flex-col items-center gap-2 text-sm font-medium">
              <ImagePlus className="h-8 w-8 text-rose-deep" aria-hidden />
              Choose a photo or video
            </span>
          )}
        </button>
        <input ref={inputRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" className="sr-only" aria-label="Story media" onChange={(e) => pick(e.target.files?.[0])} />
        <input className="input" placeholder="Add a caption (optional)" maxLength={200} value={caption} onChange={(e) => setCaption(e.target.value)} aria-label="Story caption" />
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!file} loading={mutation.isPending}>
            Share story
          </Button>
        </div>
      </form>
    </Modal>
  );
}
