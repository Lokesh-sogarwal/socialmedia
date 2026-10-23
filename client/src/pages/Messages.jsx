import { useState } from 'react';
import { useParams } from 'react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { MessageCircle, SquarePen } from 'lucide-react';
import { api } from '../lib/api.js';
import { nextCursor } from '../lib/cache.js';
import { useSocket } from '../context/SocketContext.jsx';
import { ConversationList } from '../components/messages/ConversationList.jsx';
import { ConversationView } from '../components/messages/ConversationView.jsx';
import { NewMessageDialog } from '../components/messages/NewMessageDialog.jsx';
import { EmptyState } from '../components/ui/States.jsx';
import { Button, IconButton } from '../components/ui/Button.jsx';

export default function Messages() {
  const { id } = useParams();
  const { connected } = useSocket();
  const [composing, setComposing] = useState(false);
  const query = useInfiniteQuery({
    queryKey: ['conversations', 'list'],
    queryFn: ({ pageParam }) => api.page('/conversations', { before: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: nextCursor,
  });

  return (
    <div className={clsx('card flex overflow-hidden', id ? 'fixed inset-0 z-40 rounded-none border-0 md:static md:h-[calc(100dvh-4rem)] md:rounded-card md:border' : 'h-[calc(100dvh-var(--height-mobile-nav)-5.5rem)] md:h-[calc(100dvh-4rem)]')}>
      <aside className={clsx('flex w-full flex-col border-line md:w-80 md:border-r', id && 'hidden md:flex')} aria-label="Conversations">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h1 className="text-lg font-bold">Messages</h1>
            {!connected && <p className="text-xs text-muted">Reconnecting…</p>}
          </div>
          <IconButton label="New message" onClick={() => setComposing(true)}>
            <SquarePen className="h-5 w-5" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ConversationList query={query} />
        </div>
      </aside>
      <div className={clsx('min-w-0 flex-1', !id && 'hidden md:block')}>
        {id ? (
          <ConversationView key={id} conversationId={id} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={MessageCircle}
              title="Your messages"
              description="Send private messages to friends. Messages are delivered instantly."
              action={<Button onClick={() => setComposing(true)}>Send a message</Button>}
            />
          </div>
        )}
      </div>
      {composing && <NewMessageDialog onClose={() => setComposing(false)} />}
    </div>
  );
}
