import { useInfiniteQuery } from '@tanstack/react-query';
import { ImagePlus, RefreshCw, Users } from 'lucide-react';
import { api } from '../lib/api.js';
import { nextCursor } from '../lib/cache.js';
import { PostList } from '../components/posts/PostList.jsx';
import { StoryTray } from '../components/stories/StoryTray.jsx';
import { UserAvatar } from '../components/users/UserAvatar.jsx';
import { EmptyState } from '../components/ui/States.jsx';
import { IconButton } from '../components/ui/Button.jsx';
import { SuggestedAccounts } from '../components/layout/RightRail.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useComposer } from '../context/ComposerContext.jsx';

export default function Home() {
  const { user } = useAuth();
  const { openPost } = useComposer();
  const query = useInfiniteQuery({
    queryKey: ['feed', 'home'],
    queryFn: ({ pageParam }) => api.page('/feed', { cursor: pageParam, limit: 10 }),
    initialPageParam: undefined,
    getNextPageParam: nextCursor,
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between px-4 xs:px-0">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Home</h1>
        <IconButton label="Refresh feed" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw className={query.isRefetching ? 'h-5 w-5 animate-spin' : 'h-5 w-5'} />
        </IconButton>
      </div>
      <StoryTray />
      <div className="card mb-5 flex items-center gap-3 p-3 sm:p-4">
        <UserAvatar user={user} size="md" />
        <button
          type="button"
          onClick={() => openPost()}
          className="flex-1 rounded-full bg-background px-4 py-2.5 text-left text-muted transition hover:bg-blush/40"
        >
          What’s on your mind, {user.displayName.split(' ')[0]}?
        </button>
        <button type="button" onClick={() => openPost()} className="rounded-full p-2.5 hover:bg-blush/60" aria-label="Add photos or video">
          <ImagePlus className="h-5 w-5" />
        </button>
      </div>
      <PostList
        query={query}
        empty={
          <div className="space-y-5">
            <div className="card">
              <EmptyState
                icon={Users}
                title="Your feed is waiting"
                description="Follow a few people to see their posts here, or share your first post."
              />
            </div>
            <SuggestedAccounts limit={6} title="People you might like" />
          </div>
        }
      />
    </div>
  );
}
