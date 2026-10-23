import { forwardRef } from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-rose text-charcoal hover:bg-rose/85 active:bg-rose/75 font-semibold',
  dark: 'bg-charcoal text-surface hover:bg-charcoal/90 font-semibold',
  secondary: 'bg-blush/70 text-charcoal hover:bg-blush font-medium',
  outline: 'border border-line bg-surface text-charcoal hover:bg-blush/40 font-medium',
  ghost: 'text-charcoal hover:bg-blush/50 font-medium',
  danger: 'bg-danger text-surface hover:bg-danger/90 font-semibold',
};
const SIZES = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
};

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, className, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex select-none items-center justify-center whitespace-nowrap rounded-control transition disabled:cursor-not-allowed disabled:opacity-55',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export const IconButton = forwardRef(function IconButton({ label, className, children, active, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex h-10 w-10 items-center justify-center rounded-full text-charcoal transition hover:bg-blush/60 disabled:opacity-50',
        active && 'bg-blush/60',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
