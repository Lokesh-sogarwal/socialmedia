import { useEffect, useId, useRef, useState } from 'react';
import clsx from 'clsx';

/**
 * Menu-button pattern: arrow keys move between items, Escape closes and
 * returns focus to the trigger, clicking outside closes.
 */
export function DropdownMenu({ trigger, items, align = 'right', side = 'bottom', label = 'More options' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuId = useId();
  const visible = items.filter(Boolean);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    rootRef.current?.querySelector('[role="menuitem"]')?.focus();
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function onKeyDown(e) {
    const nodes = [...(rootRef.current?.querySelectorAll('[role="menuitem"]') ?? [])];
    const index = nodes.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      nodes[(index + 1) % nodes.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nodes[(index - 1 + nodes.length) % nodes.length]?.focus();
    } else if (e.key === 'Escape') {
      setOpen(false);
      buttonRef.current?.focus();
    }
  }

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-charcoal transition hover:bg-blush/60"
      >
        {trigger}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className={clsx(
            'absolute z-40 min-w-[12rem] overflow-hidden rounded-control border border-line bg-surface py-1 shadow-pop',
            align === 'right' ? 'right-0' : 'left-0',
            side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
        >
          {visible.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={clsx(
                'flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm hover:bg-blush/50 focus:bg-blush/50 focus:outline-none',
                item.danger && 'text-danger',
              )}
            >
              {item.icon && <item.icon className="h-4 w-4" aria-hidden />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
