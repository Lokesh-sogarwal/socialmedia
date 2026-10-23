import { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createSocket } from '../lib/socket.js';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext({ socket: null, connected: false });

function upsertConversation(list, conversation) {
  if (!Array.isArray(list)) return list;
  return [conversation, ...list.filter((c) => c._id !== conversation._id)];
}

/**
 * Owns the socket lifecycle and folds realtime events into the query cache,
 * so badges, conversation lists and open threads update without refetching.
 */
export function SocketProvider({ children }) {
  const { status, user } = useAuth();
  const qc = useQueryClient();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const userId = user?._id;

  useEffect(() => {
    if (status !== 'authenticated' || !userId) return undefined;
    const s = createSocket();

    s.on('connect', () => {
      setConnected(true);
      // Catch up on anything missed while disconnected.
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['messages'] });
    });
    s.on('disconnect', () => setConnected(false));

    s.on('notification:new', ({ notification, unreadCount }) => {
      qc.setQueryData(['notifications', 'unread'], unreadCount);
      qc.setQueryData(['notifications', 'list'], (data) =>
        data?.pages
          ? {
              ...data,
              pages: data.pages.map((p, i) =>
                i === 0 ? { ...p, data: [notification, ...p.data.filter((n) => n._id !== notification._id)] } : p,
              ),
            }
          : data,
      );
      if (notification.type === 'follow_request') qc.invalidateQueries({ queryKey: ['followRequests'] });
    });
    s.on('notification:count', ({ unreadCount }) => qc.setQueryData(['notifications', 'unread'], unreadCount));

    s.on('message:new', ({ message, conversation }) => {
      qc.setQueryData(['messages', conversation._id], (data) => {
        if (!data?.pages) return data;
        const exists = data.pages.some((p) => p.data.some((m) => m._id === message._id || (message.clientId && m.clientId === message.clientId)));
        if (exists) {
          return {
            ...data,
            pages: data.pages.map((p) => ({
              ...p,
              data: p.data.map((m) => (message.clientId && m.clientId === message.clientId ? message : m)),
            })),
          };
        }
        return { ...data, pages: data.pages.map((p, i) => (i === 0 ? { ...p, data: [message, ...p.data] } : p)) };
      });
      qc.setQueryData(['conversations', 'list'], (data) =>
        data?.pages
          ? { ...data, pages: data.pages.map((p, i) => (i === 0 ? { ...p, data: upsertConversation(p.data, conversation) } : { ...p, data: p.data.filter((c) => c._id !== conversation._id) })) }
          : data,
      );
      qc.setQueryData(['conversation', conversation._id], (c) => (c ? { ...c, ...conversation } : c));
      qc.invalidateQueries({ queryKey: ['conversations', 'unread'] });
    });

    s.on('conversation:read', ({ conversationId, readerId, lastReadAt }) => {
      const mine = readerId === userId;
      const patch = (c) => (c?._id === conversationId ? { ...c, ...(mine ? { unread: 0 } : { otherLastReadAt: lastReadAt }) } : c);
      qc.setQueryData(['conversation', conversationId], (c) => (c ? patch(c) : c));
      qc.setQueryData(['conversations', 'list'], (data) =>
        data?.pages ? { ...data, pages: data.pages.map((p) => ({ ...p, data: p.data.map(patch) })) } : data,
      );
      if (mine) qc.invalidateQueries({ queryKey: ['conversations', 'unread'] });
    });

    s.on('presence', ({ userId: who, online }) => {
      const patch = (c) => (c?.other?._id === who ? { ...c, online } : c);
      qc.setQueryData(['conversations', 'list'], (data) =>
        data?.pages ? { ...data, pages: data.pages.map((p) => ({ ...p, data: p.data.map(patch) })) } : data,
      );
      qc.setQueriesData({ queryKey: ['conversation'] }, (c) => (c ? patch(c) : c));
    });

    s.connect();
    setSocket(s);
    return () => {
      s.removeAllListeners();
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [status, userId, qc]);

  return <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);
