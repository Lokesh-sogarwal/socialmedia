import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

/** Unread counts for nav badges; kept fresh by socket events, polled slowly as a fallback. */
export function useBadges() {
  const notifications = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get('/notifications/unread-count').then((d) => d.unreadCount),
    refetchInterval: 120_000,
  });
  const messages = useQuery({
    queryKey: ['conversations', 'unread'],
    queryFn: () => api.get('/conversations/unread-count').then((d) => d.unreadCount),
    refetchInterval: 120_000,
  });
  return { notifications: notifications.data ?? 0, messages: messages.data ?? 0 };
}
