import clsx from 'clsx';

export function Badge({ count, className }) {
  if (!count) return null;
  return (
    <span
      className={clsx(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-charcoal px-1 text-[10px] font-bold leading-none text-surface',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
      <span className="sr-only"> unread</span>
    </span>
  );
}
