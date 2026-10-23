import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Ban, CalendarDays, Clapperboard, Flag, Grid3x3, Link as LinkIcon, Lock, MapPin, MoreHorizontal, UserMinus, UserX } from 'lucide-react';
import { api } from '../lib/api.js';
import { nextCursor } from '../lib/cache.js';
import { compactNumber } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { UserAvatar } from '../components/users/UserAvatar.jsx';
import { FollowButton } from '../components/users/FollowButton.jsx';
import { PostGrid } from '../components/posts/PostGrid.jsx';
import { Button } from '../components/ui/Button.jsx';
import { DropdownMenu } from '../components/ui/DropdownMenu.jsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';
import { ReportDialog } from '../components/ReportDialog.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { Skeleton } from '../components/ui/SkeletonLoader.jsx';
import { RichText } from '../components/RichText.jsx';
import NotFound from './NotFound.jsx';

function Stat({ value, label, to }) {
  const content = (
    <>
      <span className="block text-lg font-bold">{compactNumber(value)}</span>
      <span className="text-sm text-muted">{label}</span>
    </>
  );
  return to ? (
    <Link to={to} className="rounded-control px-2 text-center hover:bg-blush/40">
      {content}
    </Link>
  ) : (
    <div className="px-2 text-center">{content}</div>
  );
}

function ProfilePosts({ username, videos }) {
  const query = useInfiniteQuery({
    queryKey: ['userPosts', username, videos],
    queryFn: ({ pageParam }) => api.page(`/users/${username}/posts`, { cursor: pageParam, limit: 24, videos: videos ? 'true' : undefined }),
    initialPageParam: undefined,
    getNextPageParam: nextCursor,
  });
  return (
    <PostGrid
      query={query}
      empty={<EmptyState icon={videos ? Clapperboard : Grid3x3} title={videos ? 'No reels yet' : 'No posts yet'} description={videos ? 'Videos shared by this account appear here.' : 'When posts are shared, they’ll appear here.'} />}
    />
  );
}

export default function Profile() {
  const { username } = useParams();
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState('posts');
  const [dialog, setDialog] = useState(null);

  const query = useQuery({ queryKey: ['profile', username], queryFn: () => api.get(`/users/${username}`) });

  const message = useMutation({
    mutationFn: () => api.post('/conversations', { userId: query.data.user._id }),
    onSuccess: (c) => navigate(`/messages/${c._id}`),
    onError: (err) => toast.error(err.message),
  });
  const block = useMutation({
    mutationFn: () => api.post(`/users/${query.data.user._id}/block`),
    onSuccess: () => {
      toast.success(`@${username} is blocked`);
      qc.invalidateQueries();
      navigate('/');
    },
    onError: (err) => toast.error(err.message),
  });
  const removeFollower = useMutation({
    mutationFn: () => api.delete(`/follows/followers/${query.data.user._id}`),
    onSuccess: () => {
      toast.success('Follower removed');
      setDialog(null);
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err) => toast.error(err.message),
  });

  if (query.isPending) {
    return (
      <div className="card overflow-hidden" aria-busy>
        <Skeleton className="h-40 w-full rounded-none sm:h-56" />
        <div className="space-y-3 p-6">
          <Skeleton className="h-24 w-24 rounded-full" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
    );
  }
  if (query.isError) return query.error.status === 404 ? <NotFound title="This account isn’t available" description="The link may be broken, or the profile may have been removed." /> : <ErrorState error={query.error} onRetry={query.refetch} />;

  const { user, relationship, canView } = query.data;
  const isMe = me._id === user._id;

  return (
    <div>
      <section className="card overflow-hidden">
        <div className="h-36 bg-blush sm:h-52">{user.cover?.url && <img src={user.cover.url} alt="" className="h-full w-full object-cover" />}</div>
        <div className="px-5 pb-5 sm:px-8">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-3 sm:-mt-16">
            <UserAvatar user={user} size="xl" className="border-4 border-surface bg-surface" />
            <div className="flex items-center gap-2 pb-1">
              {isMe ? (
                <>
                  <Link to="/settings/profile">
                    <Button variant="outline">Edit profile</Button>
                  </Link>
                  <Link to="/settings">
                    <Button variant="ghost">Settings</Button>
                  </Link>
                </>
              ) : (
                <>
                  <FollowButton user={user} status={relationship.followStatus} followsMe={relationship.followsMe} size="md" />
                  <Button variant="outline" onClick={() => message.mutate()} loading={message.isPending}>
                    Message
                  </Button>
                  <DropdownMenu
                    label="Profile options"
                    trigger={<MoreHorizontal className="h-5 w-5" />}
                    items={[
                      relationship.followsMe && { label: 'Remove follower', icon: UserMinus, onSelect: () => setDialog('remove') },
                      { label: 'Block', icon: Ban, danger: true, onSelect: () => setDialog('block') },
                      { label: 'Report', icon: Flag, danger: true, onSelect: () => setDialog('report') },
                    ]}
                  />
                </>
              )}
            </div>
          </div>

          <div className="mt-4">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              {user.displayName}
              {user.isPrivate && <Lock className="h-4 w-4 text-muted" aria-label="Private account" />}
            </h1>
            <p className="text-muted">
              @{user.username}
              {relationship.followsMe && <span className="ml-2 rounded-md bg-blush/70 px-1.5 py-0.5 text-xs text-charcoal">Follows you</span>}
            </p>
            {user.bio && (
              <p className="mt-3 max-w-xl whitespace-pre-line">
                <RichText text={user.bio} />
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
              {user.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" aria-hidden />
                  {user.location}
                </span>
              )}
              {user.website && (
                <a href={user.website} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1.5 font-medium text-charcoal hover:underline">
                  <LinkIcon className="h-4 w-4" aria-hidden />
                  {user.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" aria-hidden />
                Joined {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>

          <div className="mt-5 flex gap-4 border-t border-line pt-4 sm:gap-8">
            <Stat value={user.postsCount} label={user.postsCount === 1 ? 'post' : 'posts'} />
            <Stat value={user.followersCount} label="followers" to={canView ? `/u/${user.username}/followers` : undefined} />
            <Stat value={user.followingCount} label="following" to={canView ? `/u/${user.username}/following` : undefined} />
          </div>
        </div>
      </section>

      {canView ? (
        <section className="mt-5">
          <div role="tablist" aria-label="Profile content" className="mb-4 flex justify-center gap-2">
            {[
              ['posts', 'Posts', Grid3x3],
              ['reels', 'Reels', Clapperboard],
            ].map(([value, label, Icon]) => (
              <button
                key={value}
                role="tab"
                type="button"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={clsx('flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition', tab === value ? 'bg-rose' : 'text-muted hover:bg-blush/50')}
              >
                <Icon className="h-4 w-4" aria-hidden /> {label}
              </button>
            ))}
            {isMe && (
              <Link to="/saved" className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-muted hover:bg-blush/50">
                Saved
              </Link>
            )}
          </div>
          <div role="tabpanel" className="px-1 xs:px-0">
            <ProfilePosts username={user.username} videos={tab === 'reels'} />
          </div>
        </section>
      ) : (
        <div className="card mt-5">
          <EmptyState
            icon={Lock}
            title="This account is private"
            description={relationship.followStatus === 'pending' ? 'Your follow request is pending.' : 'Follow this account to see their photos and videos.'}
          />
        </div>
      )}

      {dialog === 'block' && (
        <ConfirmDialog
          title={`Block @${user.username}?`}
          description="They won’t be able to find your profile, see your posts or message you. Any follows between you are removed. They won’t be notified."
          confirmLabel="Block"
          loading={block.isPending}
          onCancel={() => setDialog(null)}
          onConfirm={() => block.mutate()}
        >
          <UserX className="sr-only" />
        </ConfirmDialog>
      )}
      {dialog === 'remove' && (
        <ConfirmDialog
          title="Remove follower?"
          description={`@${user.username} won’t be told they were removed.`}
          confirmLabel="Remove"
          loading={removeFollower.isPending}
          onCancel={() => setDialog(null)}
          onConfirm={() => removeFollower.mutate()}
        />
      )}
      {dialog === 'report' && <ReportDialog targetType="user" target={user._id} onClose={() => setDialog(null)} />}
    </div>
  );
}
