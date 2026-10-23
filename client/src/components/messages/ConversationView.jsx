import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send } from 'lucide-react';
import { api } from '../../lib/api.js';
import { nextCursor } from '../../lib/cache.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { UserAvatar } from '../users/UserAvatar.jsx';
import { Spinner } from '../ui/Spinner.jsx';
import { ErrorState } from '../ui/States.jsx';
import { Button } from '../ui/Button.jsx';
import { MessageBubble } from './MessageBubble.jsx';

const GAP_MS = 10 * 60 * 1000;

function dayLabel(date) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

const newClientId = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/[^A-Za-z0-9_-]/g, '');

export function ConversationView({ conversationId }) {
  const { user: me } = useAuth();
  const { socket } = useSocket();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const [otherTyping, setOtherTyping] = useState(false);
  const scrollRef = useRef(null);
  const stickToBottom = useRef(true);
  const lastTypingSent = useRef(0);

  const convo = useQuery({ queryKey: ['conversation', conversationId], queryFn: () => api.get(`/conversations/${conversationId}`) });
  const messagesKey = ['messages', conversationId];
  const messages = useInfiniteQuery({
    queryKey: messagesKey,
    queryFn: ({ pageParam }) => api.page(`/conversations/${conversationId}/messages`, { cursor: pageParam, limit: 30 }),
    initialPageParam: undefined,
    getNextPageParam: nextCursor,
  });
  // Pages are newest-first; display oldest at the top.
  const list = useMemo(() => (messages.data?.pages.flatMap((p) => p.data) ?? []).slice().reverse(), [messages.data]);

  const markRead = useCallback(() => {
    if (document.visibilityState !== 'visible') return;
    api
      .post(`/conversations/${conversationId}/read`)
      .then(() => qc.invalidateQueries({ queryKey: ['conversations', 'unread'] }))
      .catch(() => {});
  }, [conversationId, qc]);

  const newestId = list[list.length - 1]?._id;
  const newestFromOther = list.length > 0 && list[list.length - 1].sender !== me._id;
  useEffect(() => {
    if (messages.isSuccess && (newestFromOther || convo.data?.unread)) markRead();
  }, [newestId, messages.isSuccess, newestFromOther, convo.data?.unread, markRead]);

  useEffect(() => {
    document.addEventListener('visibilitychange', markRead);
    return () => document.removeEventListener('visibilitychange', markRead);
  }, [markRead]);

  // Typing indicator from the other participant.
  useEffect(() => {
    if (!socket) return undefined;
    let timer;
    const onTyping = (e) => {
      if (e.conversationId !== conversationId) return;
      setOtherTyping(e.isTyping);
      clearTimeout(timer);
      if (e.isTyping) timer = setTimeout(() => setOtherTyping(false), 4000);
    };
    const onMessage = ({ message }) => {
      if (message.conversation === conversationId && message.sender !== me._id) setOtherTyping(false);
    };
    socket.on('typing', onTyping);
    socket.on('message:new', onMessage);
    return () => {
      clearTimeout(timer);
      socket.off('typing', onTyping);
      socket.off('message:new', onMessage);
    };
  }, [socket, conversationId, me._id]);

  // Keep the view pinned to the newest message unless the user scrolled up.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [list.length, otherTyping]);

  function onScroll(e) {
    const el = e.currentTarget;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 60 && messages.hasNextPage && !messages.isFetchingNextPage) {
      const before = el.scrollHeight;
      messages.fetchNextPage().then(() => requestAnimationFrame(() => (el.scrollTop = el.scrollHeight - before)));
    }
  }

  function setMessage(clientId, patch) {
    qc.setQueryData(messagesKey, (data) =>
      data ? { ...data, pages: data.pages.map((p) => ({ ...p, data: p.data.map((m) => (m.clientId === clientId ? { ...m, ...patch } : m)) })) } : data,
    );
  }

  const send = useMutation({
    mutationFn: ({ body, clientId }) => api.post(`/conversations/${conversationId}/messages`, { body, clientId }),
    onMutate: ({ body, clientId, retry }) => {
      stickToBottom.current = true;
      if (retry) return setMessage(clientId, { status: 'sending' });
      const optimistic = { _id: `tmp-${clientId}`, clientId, body, sender: me._id, conversation: conversationId, createdAt: new Date().toISOString(), status: 'sending' };
      qc.setQueryData(messagesKey, (data) =>
        data ? { ...data, pages: data.pages.map((p, i) => (i === 0 ? { ...p, data: [optimistic, ...p.data] } : p)) } : data,
      );
      return undefined;
    },
    onSuccess: (saved, { clientId }) => setMessage(clientId, { ...saved, status: undefined }),
    onError: (_err, { clientId }) => setMessage(clientId, { status: 'failed' }),
  });

  function submit(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    socket?.emit('typing', { conversationId, isTyping: false });
    send.mutate({ body, clientId: newClientId() });
  }

  function onDraftChange(value) {
    setDraft(value);
    const now = Date.now();
    if (socket && value && now - lastTypingSent.current > 2000) {
      lastTypingSent.current = now;
      socket.emit('typing', { conversationId, isTyping: true });
    }
  }

  if (convo.isError) return <ErrorState error={convo.error} onRetry={convo.refetch} title="Conversation unavailable" />;
  const c = convo.data;
  const other = c?.other ?? { username: 'deleted', displayName: 'Deleted account' };
  const lastMine = [...list].reverse().find((m) => m.sender === me._id && !m.status);
  const seenId = lastMine && c?.otherLastReadAt && new Date(c.otherLastReadAt) >= new Date(lastMine.createdAt) ? lastMine._id : null;

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label={`Conversation with ${other.displayName}`}>
      <header className="flex items-center gap-3 border-b border-line bg-surface px-3 py-2.5 sm:px-5">
        <button type="button" onClick={() => navigate('/messages')} className="rounded-full p-2 hover:bg-blush/60 md:hidden" aria-label="Back to conversations">
          <ArrowLeft className="h-5 w-5" />
        </button>
        {c ? (
          <Link to={c.other ? `/u/${other.username}` : '#'} className="flex min-w-0 items-center gap-3">
            <UserAvatar user={other} size="sm" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-semibold">{other.displayName}</span>
              <span className="block text-xs text-muted" aria-live="polite">
                {otherTyping ? 'typing…' : c.online ? 'Active now' : `@${other.username}`}
              </span>
            </span>
          </Link>
        ) : (
          <Spinner />
        )}
      </header>

      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-background px-3 py-4 sm:px-6" role="log" aria-live="polite" aria-relevant="additions">
        {messages.isFetchingNextPage && <div className="flex justify-center py-2"><Spinner /></div>}
        {messages.isPending && <div className="flex justify-center py-10"><Spinner /></div>}
        {messages.isError && <ErrorState error={messages.error} onRetry={messages.refetch} />}
        {messages.isSuccess && list.length === 0 && c && (
          <div className="flex flex-col items-center py-10 text-center">
            <UserAvatar user={other} size="lg" />
            <p className="mt-3 font-semibold">{other.displayName}</p>
            <p className="text-sm text-muted">Say hi to start the conversation.</p>
          </div>
        )}
        {list.map((m, i) => {
          const prev = list[i - 1];
          const nextMsg = list[i + 1];
          const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
          const showTime = !nextMsg || nextMsg.sender !== m.sender || new Date(nextMsg.createdAt) - new Date(m.createdAt) > GAP_MS;
          return (
            <Fragment key={m._id}>
              {newDay && <p className="py-3 text-center text-xs font-medium text-muted">{dayLabel(m.createdAt)}</p>}
              <MessageBubble
                message={m}
                mine={m.sender === me._id}
                showTime={showTime}
                seen={m._id === seenId}
                onRetry={() => send.mutate({ body: m.body, clientId: m.clientId, retry: true })}
              />
            </Fragment>
          );
        })}
        {otherTyping && (
          <div className="flex items-center gap-1 px-2 py-2" aria-hidden>
            {[0, 150, 300].map((d) => (
              <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-rose-deep" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        )}
      </div>

      {c?.blocked ? (
        <p className="border-t border-line bg-surface px-5 py-4 text-center text-sm text-muted">You can’t reply to this conversation.</p>
      ) : (
        <form onSubmit={submit} className="pb-safe flex items-end gap-2 border-t border-line bg-surface px-3 py-3 sm:px-5">
          <label htmlFor="message-input" className="sr-only">
            Message
          </label>
          <textarea
            id="message-input"
            rows={1}
            value={draft}
            maxLength={2000}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
            }}
            placeholder="Message…"
            className="input max-h-32 min-h-[2.75rem] resize-none rounded-3xl py-2.5"
          />
          <Button type="submit" className="h-11 w-11 shrink-0 rounded-full p-0" disabled={!draft.trim()} aria-label="Send message">
            <Send className="h-5 w-5" />
          </Button>
        </form>
      )}
    </section>
  );
}
