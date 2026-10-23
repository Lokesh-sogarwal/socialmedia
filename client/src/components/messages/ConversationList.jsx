import { NavLink } from 'react-router';
import clsx from 'clsx';
import { MessageCircle } from 'lucide-react';
import { UserAvatar } from '../users/UserAvatar.jsx';
import { UserRowSkeleton } from '../ui/SkeletonLoader.jsx';
import { EmptyState, ErrorState } from '../ui/States.jsx';
import { InfiniteSentinel } from '../ui/InfiniteSentinel.jsx';
import { flattenPages } from '../../lib/cache.js';
import { timeAgo } from '../../lib/format.js';
import { useAuth } from '../../context/AuthContext.jsx';

export function ConversationList({ query }) {
  const { user: me } = useAuth();
  const conversations = flattenPages(query.data);
  if (query.isPending) return <div className="p-5"><UserRowSkeleton count={6} /></div>;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  if (!conversations.length) {
    return <EmptyState icon={MessageCircle} title="No messages yet" description="Start a conversation with someone you follow." />;
  }
  return (
    <ul>
      {conversations.map((c) => {
        const other = c.other ?? { username: 'deleted', displayName: 'Deleted account' };
        const fromMe = c.lastMessage?.sender === me._id;
        return (
          <li key={c._id}>
            <NavLink
              to={`/messages/${c._id}`}
              className={({ isActive }) => clsx('flex items-center gap-3 px-4 py-3 transition', isActive ? 'bg-rose/35' : 'hover:bg-blush/30')}
            >
              <span className="relative">
                <UserAvatar user={other} size="md" />
                {c.online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-rose-deep" aria-label="Online" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={clsx('block truncate', c.unread ? 'font-bold' : 'font-semibold')}>{other.displayName}</span>
                <span className={clsx('block truncate text-sm', c.unread ? 'font-semibold text-charcoal' : 'text-muted')}>
                  {fromMe && 'You: '}
                  {c.lastMessage?.body}
                  {c.lastMessage && <span className="font-normal text-muted"> · {timeAgo(c.lastMessage.createdAt)}</span>}
                </span>
              </span>
              {c.unread > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-charcoal px-1.5 text-[11px] font-bold text-surface">
                  {c.unread}
                  <span className="sr-only"> unread</span>
                </span>
              )}
            </NavLink>
          </li>
        );
      })}
      <InfiniteSentinel query={query} />
    </ul>
  );
}
