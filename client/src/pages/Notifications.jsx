import { useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '../lib/api.js';
import { flattenPages, nextCursor } from '../lib/cache.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { NotificationItem } from '../components/notifications/NotificationItem.jsx';
import { UserCard } from '../components/users/UserCard.jsx';
import { Button } from '../components/ui/Button.jsx';
import { UserRowSkeleton } from '../components/ui/SkeletonLoader.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { InfiniteSentinel } from '../components/ui/InfiniteSentinel.jsx';
import { useToast } from '../context/ToastContext.jsx';

function FollowRequests() {
  const qc = useQueryClient();
  const toast = useToast();
  const query = useInfiniteQuery({
    queryKey: ['followRequests'],
    queryFn: ({ pageParam }) => api.page('/follows/requests', { cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: nextCursor,
  });
  const respond = useMutation({
    mutationFn: ({ id, accept }) => (accept ? api.post(`/follows/requests/${id}/accept`) : api.delete(`/follows/requests/${id}`)),
    onSuccess: (_d, { accept }) => {
      toast.success(accept ? 'Request accepted' : 'Request removed');
      qc.invalidateQueries({ queryKey: ['followRequests'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err) => toast.error(err.message),
  });
  const requests = flattenPages(query.data);
  if (!requests.length) return null;
  return (
    <section aria-labelledby="requests-heading" className="card mb-5 p-5">
      <h2 id="requests-heading" className="mb-4 font-semibold">
        Follow requests <span className="text-muted">({requests.length})</span>
      </h2>
      <div className="space-y-4">
        {requests.map((r) => (
          <UserCard
            key={r._id}
            user={r.user}
            action={
              <div className="flex gap-2">
                <Button size="sm" onClick={() => respond.mutate({ id: r.user._id, accept: true })} disabled={respond.isPending} aria-label={`Confirm @${r.user.username}`}>
                  Confirm
                </Button>
                <Button size="sm" variant="outline" onClick={() => respond.mutate({ id: r.user._id, accept: false })} disabled={respond.isPending} aria-label={`Delete request from @${r.user.username}`}>
                  Delete
                </Button>
              </div>
            }
          />
        ))}
      </div>
      <InfiniteSentinel query={query} />
    </section>
  );
}

export default function Notifications() {
  const qc = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: ['notifications', 'list'],
    queryFn: ({ pageParam }) => api.page('/notifications', { cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: nextCursor,
  });
  const notifications = flattenPages(query.data);
  const hasUnread = notifications.some((n) => !n.read);

  const markAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      qc.setQueryData(['notifications', 'unread'], 0);
      qc.setQueryData(['notifications', 'list'], (data) =>
        data ? { ...data, pages: data.pages.map((p) => ({ ...p, data: p.data.map((n) => ({ ...n, read: true })) })) } : data,
      );
    },
  });
  const markOne = useMutation({
    mutationFn: (id) => api.post(`/notifications/${id}/read`),
    onSuccess: (d) => qc.setQueryData(['notifications', 'unread'], d.unreadCount),
  });

  // Visiting the page clears the badge; unread rows stay highlighted for this visit.
  useEffect(() => {
    if (query.isSuccess) {
      api
        .post('/notifications/read-all')
        .then(() => qc.setQueryData(['notifications', 'unread'], 0))
        .catch(() => {});
    }
  }, [query.isSuccess, qc]);

  return (
    <div>
      <PageHeader
        title="Notifications"
        actions={
          hasUnread && (
            <Button variant="ghost" size="sm" onClick={() => markAll.mutate()} loading={markAll.isPending}>
              <CheckCheck className="h-4 w-4" aria-hidden /> Mark all read
            </Button>
          )
        }
      />
      <FollowRequests />
      <div className="card overflow-hidden">
        {query.isPending && (
          <div className="p-5">
            <UserRowSkeleton count={6} />
          </div>
        )}
        {query.isError && <ErrorState error={query.error} onRetry={query.refetch} />}
        {query.isSuccess && notifications.length === 0 && (
          <EmptyState icon={Bell} title="No notifications yet" description="When people follow you, like or comment on your posts, you’ll see it here." />
        )}
        <ul className="divide-y divide-line">
          {notifications.map((n) => (
            <NotificationItem key={n._id} notification={n} onOpen={(item) => !item.read && markOne.mutate(item._id)} />
          ))}
        </ul>
        <InfiniteSentinel query={query} />
      </div>
    </div>
  );
}
