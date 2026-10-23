import clsx from 'clsx';
import { AlertCircle } from 'lucide-react';
import { clockTime, fullDate } from '../../lib/format.js';

export function MessageBubble({ message, mine, showTime, seen, onRetry }) {
  return (
    <div className={clsx('flex flex-col', mine ? 'items-end' : 'items-start')}>
      <div
        className={clsx(
          'max-w-[80%] whitespace-pre-wrap break-words rounded-3xl px-4 py-2 text-[15px] sm:max-w-[65%]',
          mine ? 'rounded-br-md bg-rose text-charcoal' : 'rounded-bl-md border border-line bg-surface',
          message.status === 'sending' && 'opacity-60',
        )}
        title={fullDate(message.createdAt)}
      >
        {message.body}
      </div>
      {message.status === 'failed' ? (
        <button type="button" onClick={onRetry} className="mt-1 flex items-center gap-1 text-xs text-danger hover:underline">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden /> Not sent — tap to retry
        </button>
      ) : (
        (showTime || seen) && (
          <span className="mt-1 px-1 text-[11px] text-muted">
            {showTime && <time dateTime={message.createdAt}>{clockTime(message.createdAt)}</time>}
            {seen && <span>{showTime ? ' · ' : ''}Seen</span>}
          </span>
        )
      )}
    </div>
  );
}
