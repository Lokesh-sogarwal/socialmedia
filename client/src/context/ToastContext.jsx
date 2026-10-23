import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (message, { tone = 'success', duration = 3500 } = {}) => {
      idRef.current += 1;
      const id = idRef.current;
      setToasts((t) => [...t.slice(-2), { id, message, tone }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );
  const toast = useMemo(
    () => ({ success: (m) => show(m), error: (m) => show(m, { tone: 'error', duration: 5000 }) }),
    [show],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--height-mobile-nav)+1rem)] z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-control bg-charcoal px-4 py-3 text-sm text-surface shadow-pop"
          >
            {t.tone === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-blush" aria-hidden />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-rose" aria-hidden />
            )}
            <span>{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="ml-1 rounded p-0.5 text-surface/70 hover:text-surface" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
