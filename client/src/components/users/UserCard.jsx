import { Link } from 'react-router';
import { Lock } from 'lucide-react';
import { UserAvatar } from './UserAvatar.jsx';
import { FollowButton } from './FollowButton.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export function UserCard({ user, subtitle, action, showFollow = true }) {
  const { user: me } = useAuth();
  const isMe = me?._id === user._id;
  return (
    <div className="flex items-center gap-3">
      <Link to={`/u/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-control">
        <UserAvatar user={user} size="md" />
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate font-semibold">
            <span className="truncate">{user.displayName}</span>
            {user.isPrivate && <Lock className="h-3.5 w-3.5 shrink-0 text-muted" aria-label="Private account" />}
          </p>
          <p className="truncate text-sm text-muted">{subtitle ?? `@${user.username}`}</p>
        </div>
      </Link>
      {action ?? (showFollow && !isMe && <FollowButton user={user} status={user.followStatus} />)}
    </div>
  );
}
