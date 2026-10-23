import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

export function Spinner({ className, label = 'Loading' }) {
  return (
    <span role="status" className={clsx('inline-flex items-center justify-center text-muted', className)}>
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner />
    </div>
  );
}
