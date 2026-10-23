import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '../../lib/api.js';
import { UserAvatar } from '../users/UserAvatar.jsx';
import { Skeleton } from '../ui/SkeletonLoader.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useComposer } from '../../context/ComposerContext.jsx';
import { StoryViewer } from './StoryViewer.jsx';

export function StoryTray() {
  const { user } = useAuth();
  const { openStory } = useComposer();
  const [viewing, setViewing] = useState(null);
  const query = useQuery({ queryKey: ['stories', 'feed'], queryFn: () => api.get('/stories/feed') });
  const tray = query.data ?? [];
  const mine = tray.find((t) => t.isMine);
  const others = tray.filter((t) => !t.isMine);

  return (
    <section aria-label="Stories" className="card mb-5 px-3 py-4 sm:px-4">
      <ul className="no-scrollbar flex gap-4 overflow-x-auto px-1 py-1">
        <li className="flex w-16 shrink-0 flex-col items-center gap-1.5">
          <div className="relative">
            <button
              type="button"
              onClick={() => (mine ? setViewing(0) : openStory())}
              aria-label={mine ? 'View your story' : 'Add to your story'}
              className="rounded-full"
            >
              <UserAvatar user={user} size="lg" ring={mine ? 'seen' : undefined} />
            </button>
            <button
              type="button"
              onClick={openStory}
              aria-label="Add to your story"
              className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-rose text-charcoal"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={3} />
            </button>
          </div>
          <span className="w-full truncate text-center text-xs text-muted">Your story</span>
        </li>
        {query.isPending &&
          Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="flex w-16 shrink-0 flex-col items-center gap-1.5" aria-hidden>
              <Skeleton className="h-16 w-16 rounded-full" />
              <Skeleton className="h-2.5 w-12" />
            </li>
          ))}
        {others.map((t) => (
          <li key={t.user._id} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
            <button type="button" onClick={() => setViewing(tray.indexOf(t))} className="rounded-full" aria-label={`View ${t.user.displayName}'s story${t.hasUnseen ? ' (new)' : ''}`}>
              <UserAvatar user={t.user} size="lg" ring={t.hasUnseen ? 'unseen' : 'seen'} />
            </button>
            <span className="w-full truncate text-center text-xs">{t.user.username}</span>
          </li>
        ))}
        {query.isSuccess && others.length === 0 && (
          <li className="flex items-center px-2 text-sm text-muted">Stories from people you follow will appear here.</li>
        )}
      </ul>
      {viewing !== null && <StoryViewer authors={tray.map((t) => t.user)} startIndex={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}
