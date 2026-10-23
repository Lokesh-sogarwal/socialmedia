import { useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function MediaCarousel({ media, onDoubleClick, rounded = false }) {
  const [index, setIndex] = useState(0);
  const scroller = useRef(null);
  if (!media?.length) return null;

  function go(i) {
    const next = Math.max(0, Math.min(media.length - 1, i));
    setIndex(next);
    scroller.current?.children[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  }

  function onScroll(e) {
    const el = e.currentTarget;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  }

  const first = media[0];
  const ratio = first.width && first.height ? Math.min(Math.max(first.width / first.height, 0.8), 1.91) : 1;

  return (
    <div className={clsx('group relative bg-blush/40', rounded && 'overflow-hidden rounded-control')} onDoubleClick={onDoubleClick}>
      <div
        ref={scroller}
        onScroll={onScroll}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        style={{ aspectRatio: ratio }}
        aria-roledescription="carousel"
      >
        {media.map((m, i) => (
          <div key={m.key || m.url} className="h-full w-full shrink-0 snap-start" aria-roledescription="slide" aria-label={`${i + 1} of ${media.length}`}>
            {m.type === 'video' ? (
              <video src={m.url} controls playsInline preload="metadata" className="h-full w-full bg-charcoal object-contain" />
            ) : (
              <img src={m.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            )}
          </div>
        ))}
      </div>
      {media.length > 1 && (
        <>
          {index > 0 && (
            <button onClick={() => go(index - 1)} className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-surface/90 p-1.5 shadow group-hover:block focus:block" aria-label="Previous">
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {index < media.length - 1 && (
            <button onClick={() => go(index + 1)} className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-surface/90 p-1.5 shadow group-hover:block focus:block" aria-label="Next">
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {media.map((m, i) => (
              <span key={m.key || i} className={clsx('h-1.5 w-1.5 rounded-full', i === index ? 'bg-surface' : 'bg-surface/50')} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
