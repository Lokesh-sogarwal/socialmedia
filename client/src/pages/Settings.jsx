import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, LogOut, ShieldAlert, UserPen } from 'lucide-react';
import { api, setAccessToken } from '../lib/api.js';
import { flattenPages, nextCursor } from '../lib/cache.js';
import { applyServerErrors, passwordRule } from '../lib/validation.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { Switch, TextField } from '../components/ui/Field.jsx';
import { Button } from '../components/ui/Button.jsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';
import { UserCard } from '../components/users/UserCard.jsx';
import { InfiniteSentinel } from '../components/ui/InfiniteSentinel.jsx';

function Section({ title, description, children, id }) {
  return (
    <section aria-labelledby={id} className="card p-5 sm:p-6">
      <h2 id={id} className="font-semibold">
        {title}
      </h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function PrivacySettings() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const update = useMutation({
    mutationFn: (patch) => api.patch('/users/me/settings', patch),
    onSuccess: ({ user: updated }) => {
      setUser(updated);
      qc.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Privacy settings saved');
    },
    onError: (err) => toast.error(err.message),
  });
  return (
    <Section id="privacy" title="Privacy" description="Control who sees your content and activity.">
      <div className="space-y-5">
        <Switch
          label="Private account"
          description="Only people you approve can see your posts, stories, followers and following. Switching to public approves pending requests."
          checked={user.isPrivate}
          disabled={update.isPending}
          onChange={(isPrivate) => update.mutate({ isPrivate })}
        />
        <Switch
          label="Show activity status"
          description="People you message can see when you’re online."
          checked={user.showActivityStatus}
          disabled={update.isPending}
          onChange={(showActivityStatus) => update.mutate({ showActivityStatus })}
        />
      </div>
    </Section>
  );
}

const passwordSchema = z
  .object({ currentPassword: z.string().min(1, 'Enter your current password'), newPassword: passwordRule, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

function PasswordSettings() {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(passwordSchema) });
  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      const { accessToken } = await api.post('/auth/change-password', { currentPassword, newPassword });
      setAccessToken(accessToken);
      reset();
      toast.success('Password changed. Other devices were signed out.');
    } catch (err) {
      applyServerErrors(err, setError);
    }
  });
  return (
    <Section id="password" title="Password" description="Changing your password signs you out on every other device.">
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <TextField className="sm:col-span-2" label="Current password" type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
        <TextField label="New password" type="password" autoComplete="new-password" error={errors.newPassword?.message} {...register('newPassword')} />
        <TextField label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
        {errors.root && <p className="field-error sm:col-span-2">{errors.root.message}</p>}
        <div className="sm:col-span-2">
          <Button type="submit" variant="dark" loading={isSubmitting}>
            Update password
          </Button>
        </div>
      </form>
    </Section>
  );
}

function BlockedAccounts() {
  const qc = useQueryClient();
  const toast = useToast();
  const query = useInfiniteQuery({
    queryKey: ['blocked'],
    queryFn: ({ pageParam }) => api.page('/users/me/blocked', { cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: nextCursor,
  });
  const unblock = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}/block`),
    onSuccess: () => {
      toast.success('Unblocked');
      qc.invalidateQueries({ queryKey: ['blocked'] });
    },
    onError: (err) => toast.error(err.message),
  });
  const users = flattenPages(query.data);
  return (
    <Section id="blocked" title="Blocked accounts" description="Blocked people can’t see your profile or message you.">
      {query.isSuccess && users.length === 0 && <p className="text-sm text-muted">You haven’t blocked anyone.</p>}
      <div className="space-y-4">
        {users.map((u) => (
          <UserCard
            key={u._id}
            user={u}
            action={
              <Button size="sm" variant="outline" onClick={() => unblock.mutate(u._id)} disabled={unblock.isPending}>
                Unblock
              </Button>
            }
          />
        ))}
      </div>
      <InfiniteSentinel query={query} />
    </Section>
  );
}

function DangerZone() {
  const { clear } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function logoutEverywhere() {
    try {
      await api.post('/auth/logout-all');
      clear();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.delete('/users/me', { password });
      clear();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Section id="account" title="Account" description="Manage sessions and your account.">
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={logoutEverywhere}>
          <LogOut className="h-4 w-4" aria-hidden /> Log out of all devices
        </Button>
        <Button variant="danger" onClick={() => setOpen(true)}>
          <ShieldAlert className="h-4 w-4" aria-hidden /> Delete account
        </Button>
      </div>
      {open && (
        <ConfirmDialog
          title="Delete your account?"
          description="This permanently deletes your profile, posts, comments, likes, stories and messages. This can’t be undone."
          confirmLabel="Delete forever"
          loading={busy}
          onCancel={() => setOpen(false)}
          onConfirm={remove}
        >
          <TextField className="mt-4" label="Enter your password to confirm" type="password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} error={error} />
        </ConfirmDialog>
      )}
    </Section>
  );
}

export default function Settings() {
  const { user, logout } = useAuth();
  return (
    <div>
      <PageHeader title="Settings" />
      <div className="space-y-5">
        <Link to="/settings/profile" className="card flex items-center gap-4 p-5 hover:bg-blush/20">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blush/70">
            <UserPen className="h-5 w-5" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">Edit profile</span>
            <span className="block text-sm text-muted">Photo, name, username, bio and links</span>
          </span>
          <ChevronRight className="h-5 w-5 text-muted" aria-hidden />
        </Link>
        <Section id="email" title="Email">
          <p className="text-sm">
            {user.email}{' '}
            <span className="ml-1 rounded-md bg-blush/70 px-1.5 py-0.5 text-xs">{user.emailVerified ? 'Verified' : 'Not verified'}</span>
          </p>
        </Section>
        <PrivacySettings />
        <PasswordSettings />
        <BlockedAccounts />
        <DangerZone />
        <div className="md:hidden">
          <Button variant="outline" className="w-full" onClick={logout}>
            <LogOut className="h-4 w-4" aria-hidden /> Log out
          </Button>
        </div>
      </div>
    </div>
  );
}
