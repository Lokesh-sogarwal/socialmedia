import { Link } from 'react-router';
import clsx from 'clsx';
import { UserAvatar } from '../users/UserAvatar.jsx';
import { timeAgo, fullDate } from '../../lib/format.js';

const TEXT = {
  follow: 'started following you',
  follow_request: 'requested to follow you',
  follow_accept: 'accepted your follow request',
  like_post: 'liked your post',
  like_comment: 'liked your comment',
  comment: 'commented on your post',
  reply: 'replied to your comment',
  mention: 'mentioned you',
};

function excerpt(text, n = 60) {
  if (!text) return '';
  return text.length > n ? `${text.slice(0, n).trimEnd()}…` : text;
}

export function NotificationItem({ notification: n, onOpen }) {
  const target = n.post ? `/p/${n.post._id}` : `/u/${n.actor.username}`;
  const thumb = n.post?.media?.[0];
  return (
    <li>
      <Link
        to={target}
        onClick={() => onOpen?.(n)}
        className={clsx('flex items-center gap-3 px-4 py-3 transition hover:bg-blush/30 sm:px-5', !n.read && 'bg-blush/35')}
      >
        <UserAvatar user={n.actor} size="md" />
        <div className="min-w-0 flex-1 text-sm">
          <p>
            <span className="font-semibold">{n.actor.username}</span> {TEXT[n.type]}
            {n.comment?.body && <span className="text-muted">: “{excerpt(n.comment.body)}”</span>}{' '}
            <time dateTime={n.createdAt} title={fullDate(n.createdAt)} className="whitespace-nowrap text-muted">
              {timeAgo(n.createdAt)}
            </time>
          </p>
        </div>
        {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-rose-deep" aria-label="Unread" />}
        {thumb &&
          (thumb.type === 'image' ? (
            <img src={thumb.url} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" loading="lazy" />
          ) : (
            <video src={`${thumb.url}#t=0.1`} preload="metadata" muted className="h-11 w-11 shrink-0 rounded-md object-cover" />
          ))}
      </Link>
    </li>
  );
}
