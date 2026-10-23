import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { applyServerErrors, usernameRule } from '../lib/validation.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { TextField } from '../components/ui/Field.jsx';
import { Button } from '../components/ui/Button.jsx';
import { UserAvatar } from '../components/users/UserAvatar.jsx';

const schema = z.object({
  displayName: z.string().trim().min(1, 'Name is required').max(50),
  username: usernameRule,
  bio: z.string().max(160, 'At most 160 characters'),
  website: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === '' || /^https?:\/\/\S+\.\S+$/i.test(v), 'Start with http:// or https://'),
  location: z.string().trim().max(60),
});

function ImagePicker({ field, label, current, onUploaded, children }) {
  const input = useRef(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function upload(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Choose an image file');
    if (file.size > 10 * 1024 * 1024) return toast.error('Images must be 10 MB or smaller');
    setBusy(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const { user } = await api.post(`/users/me/${field}`, form);
      onUploaded(user);
      toast.success(`${label} updated`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  async function remove() {
    setBusy(true);
    try {
      const { user } = await api.delete(`/users/me/${field}`);
      onUploaded(user);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {children}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" loading={busy} onClick={() => input.current?.click()}>
          {field === 'avatar' ? <Camera className="h-4 w-4" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}
          {current ? `Change ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
        </Button>
        {current && (
          <Button variant="ghost" size="sm" onClick={remove} disabled={busy}>
            <Trash2 className="h-4 w-4" aria-hidden /> Remove
          </Button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" aria-label={`Upload ${label.toLowerCase()}`} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}

export default function EditProfile() {
  const { user, setUser } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    setError,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { displayName: user.displayName, username: user.username, bio: user.bio, website: user.website, location: user.location },
  });

  function accept(updated) {
    setUser(updated);
    qc.invalidateQueries({ queryKey: ['profile'] });
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      const { user: updated } = await api.patch('/users/me', values);
      accept(updated);
      reset({ displayName: updated.displayName, username: updated.username, bio: updated.bio, website: updated.website, location: updated.location });
      toast.success('Profile saved');
    } catch (err) {
      applyServerErrors(err, setError);
    }
  });

  return (
    <div>
      <PageHeader back title="Edit profile" />
      <div className="card space-y-6 p-5 sm:p-7">
        <section aria-labelledby="photos-heading" className="space-y-4">
          <h2 id="photos-heading" className="font-semibold">
            Photos
          </h2>
          <ImagePicker field="avatar" label="Photo" current={user.avatar} onUploaded={accept}>
            <UserAvatar user={user} size="lg" />
          </ImagePicker>
          <ImagePicker field="cover" label="Cover" current={user.cover} onUploaded={accept}>
            <div className="h-16 w-28 shrink-0 overflow-hidden rounded-control bg-blush">{user.cover?.url && <img src={user.cover.url} alt="" className="h-full w-full object-cover" />}</div>
          </ImagePicker>
        </section>
        <form onSubmit={onSubmit} className="space-y-4 border-t border-line pt-6" noValidate>
          <TextField label="Name" error={errors.displayName?.message} {...register('displayName')} />
          <TextField label="Username" autoCapitalize="none" error={errors.username?.message} hint="Your profile link is /u/username" {...register('username')} />
          <TextField as="textarea" label="Bio" maxLength={160} error={errors.bio?.message} hint={`${watch('bio')?.length ?? 0}/160`} {...register('bio')} />
          <TextField label="Website" type="url" placeholder="https://" error={errors.website?.message} {...register('website')} />
          <TextField label="Location" error={errors.location?.message} {...register('location')} />
          {errors.root && <p className="field-error" role="alert">{errors.root.message}</p>}
          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
