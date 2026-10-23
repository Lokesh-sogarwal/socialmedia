import clsx from 'clsx';

const SIZES = { xs: 'h-7 w-7 text-[11px]', sm: 'h-9 w-9 text-xs', md: 'h-11 w-11 text-sm', lg: 'h-16 w-16 text-lg', xl: 'h-24 w-24 text-2xl sm:h-32 sm:w-32 sm:text-3xl' };

function initials(user) {
  const source = user?.displayName || user?.username || '?';
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
}

/** Avatar with initials fallback; `ring` draws the story ring (rose when unseen). */
export function UserAvatar({ user, size = 'md', ring, className }) {
  const img = user?.avatar?.url;
  const inner = img ? (
    <img src={img} alt="" className="h-full w-full rounded-full object-cover" loading="lazy" decoding="async" />
  ) : (
    <span className="flex h-full w-full items-center justify-center rounded-full bg-blush font-semibold text-charcoal">
      {initials(user)}
    </span>
  );
  return (
    <span
      className={clsx(
        'relative inline-flex shrink-0 rounded-full',
        SIZES[size],
        ring === 'unseen' && 'p-[2.5px] ring-2 ring-rose-deep ring-offset-2 ring-offset-surface',
        ring === 'seen' && 'p-[2.5px] ring-2 ring-line ring-offset-2 ring-offset-surface',
        className,
      )}
      aria-hidden
    >
      {inner}
    </span>
  );
}
