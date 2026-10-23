import { useEffect, useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { useFollowMutation } from '../../hooks/useFollow.js';

const LABELS = { none: 'Follow', pending: 'Requested', accepted: 'Following' };

export function FollowButton({ user, status = 'none', followsMe = false, size = 'sm', className }) {
  const [current, setCurrent] = useState(status);
  const [confirming, setConfirming] = useState(false);
  const mutation = useFollowMutation();
  useEffect(() => setCurrent(status), [status]);

  async function run(action) {
    const previous = current;
    setCurrent(action === 'follow' ? (user.isPrivate ? 'pending' : 'accepted') : 'none');
    try {
      const result = await mutation.mutateAsync({ userId: user._id, action });
      setCurrent(result.status);
    } catch {
      setCurrent(previous);
    }
  }

  function onClick() {
    if (current === 'none') return run('follow');
    // Unfollowing a private account loses access, so confirm it.
    if (current === 'accepted' && user.isPrivate) return setConfirming(true);
    return run('unfollow');
  }

  const label = current === 'none' && followsMe ? 'Follow back' : LABELS[current];
  return (
    <>
      <Button
        size={size}
        variant={current === 'none' ? 'primary' : 'outline'}
        onClick={onClick}
        disabled={mutation.isPending}
        className={className}
        aria-label={`${label} @${user.username}`}
      >
        {label}
      </Button>
      {confirming && (
        <ConfirmDialog
          title={`Unfollow @${user.username}?`}
          description="Their account is private, so you’ll need to request to follow them again to see their posts."
          confirmLabel="Unfollow"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            run('unfollow');
          }}
        />
      )}
    </>
  );
}
