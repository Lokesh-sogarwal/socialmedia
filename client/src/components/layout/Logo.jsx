import { Link } from 'react-router';
import clsx from 'clsx';

export function Logo({ compact = false, className }) {
  return (
    <Link to="/" className={clsx('inline-flex items-center gap-2.5 rounded-control', className)} aria-label="Socio home">
      <img src="/logo.png" alt="" className="h-9 w-9 rounded-xl bg-blush object-contain p-1" />
      {!compact && <span className="text-xl font-bold tracking-tight">Socio</span>}
    </Link>
  );
}
