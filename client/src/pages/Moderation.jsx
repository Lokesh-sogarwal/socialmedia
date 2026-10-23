import { useState } from 'react';
import { Link } from 'react-router';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ShieldCheck } from 'lucide-react';
import { api } from '../lib/api.js';
import { flattenPages, nextCursor } from '../lib/cache.js';
import { timeAgo } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { UserAvatar } from '../components/users/UserAvatar.jsx';
import { UserRowSkeleton } from '../components/ui/SkeletonLoader.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { InfiniteSentinel } from '../components/ui/InfiniteSentinel.jsx';
import NotFound from './NotFound.jsx';

function Preview({ report }) {
  const p = report.preview;
  if (!p) return <p className="text-sm italic text-muted">This content has already been removed.</p>;
  if (report.targetType === 'user') {
    return (
      <Link to={`/u/${p.username}`} className="flex items-center gap-2 text-sm font-semibold hover:underline">
        <UserAvatar user={p} size="sm" /> @{p.username}
      </Link>
    );
  }
  return (
    <div className="flex gap-3 rounded-control bg-background p-3 text-sm">
      {p.media?.[0]?.type === 'image' && <img src={p.media[0].url} alt="" className="h-16 w-16 rounded-md object-cover" />}
      <div className="min-w-0">
        <p className="text-xs text-muted">by @{p.author?.username}</p>
        <p className="line-clamp-3 break-words">{p.caption || p.body || '(no text)'}</p>
        {report.targetType === 'post' && (
          <Link to={`/p/${p._id}`} className="text-xs font-semibold hover:underline">
            Open post
          </Link>
        )}
      </div>
    </div>
  );
}

export default function Moderation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState('open');
  const allowed = ['moderator', 'admin'].includes(user.role);
  const query = useInfiniteQuery({
    queryKey: ['reports', status],
    queryFn: ({ pageParam }) => api.page('/reports', { cursor: pageParam, status }),
    initialPageParam: undefined,
    getNextPageParam: nextCursor,
    enabled: allowed,
  });
  const resolve = useMutation({
    mutationFn: ({ id, action }) => api.patch(`/reports/${id}`, { action }),
    onSuccess: (_d, { action }) => {
      toast.success(action === 'dismiss' ? 'Report dismissed' : 'Content removed');
      qc.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err) => toast.error(err.message),
  });

  if (!allowed) return <NotFound />;
  const reports = flattenPages(query.data);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Moderation" subtitle="Review reported accounts, posts and comments" />
      <div role="tablist" className="mb-4 flex gap-2 px-4 xs:px-0">
        {['open', 'actioned', 'dismissed'].map((s) => (
          <button key={s} role="tab" type="button" aria-selected={status === s} onClick={() => setStatus(s)} className={clsx('rounded-full px-4 py-1.5 text-sm font-semibold capitalize', status === s ? 'bg-rose' : 'bg-surface text-muted hover:bg-blush/50')}>
            {s}
          </button>
        ))}
      </div>
      <div className="space-y-4">
        {query.isPending && <div className="card p-5"><UserRowSkeleton /></div>}
        {query.isError && <ErrorState error={query.error} onRetry={query.refetch} />}
        {query.isSuccess && reports.length === 0 && (
          <div className="card">
            <EmptyState icon={ShieldCheck} title="Queue is clear" description={`No ${status} reports.`} />
          </div>
        )}
        {reports.map((r) => (
          <article key={r._id} className="card space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-md bg-blush px-2 py-0.5 font-semibold capitalize">{r.targetType}</span>
              <span className="rounded-md bg-rose/50 px-2 py-0.5 capitalize">{r.reason}</span>
              <span className="text-muted">
                reported by @{r.reporter?.username ?? 'deleted'} · {timeAgo(r.createdAt)}
              </span>
            </div>
            {r.details && <p className="text-sm">“{r.details}”</p>}
            <Preview report={r} />
            {status === 'open' && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => resolve.mutate({ id: r._id, action: 'dismiss' })} disabled={resolve.isPending}>
                  Dismiss
                </Button>
                {r.targetType !== 'user' && r.preview && (
                  <Button size="sm" variant="danger" onClick={() => resolve.mutate({ id: r._id, action: 'remove_content' })} disabled={resolve.isPending}>
                    Remove {r.targetType}
                  </Button>
                )}
              </div>
            )}
          </article>
        ))}
        <InfiniteSentinel query={query} />
      </div>
    </div>
  );
}
