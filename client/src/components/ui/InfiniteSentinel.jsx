import { useEffect, useRef } from 'react';
import { Spinner } from './Spinner.jsx';
import { Button } from './Button.jsx';

/** Loads the next page when scrolled into view; a button fallback keeps it keyboard-accessible. */
export function InfiniteSentinel({ query, endLabel }) {
  const ref = useRef(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage, isFetchNextPageError } = query;

  useEffect(() => {
    const node = ref.current;
    if (!node || !hasNextPage || isFetchNextPageError) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: '600px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isFetchNextPageError]);

  if (isFetchNextPageError) {
    return (
      <div className="flex justify-center py-6">
        <Button variant="outline" onClick={() => fetchNextPage()}>
          Couldn’t load more — retry
        </Button>
      </div>
    );
  }
  if (!hasNextPage) {
    return endLabel ? <p className="py-8 text-center text-sm text-muted">{endLabel}</p> : null;
  }
  return (
    <div ref={ref} className="flex justify-center py-6">
      {isFetchingNextPage ? (
        <Spinner />
      ) : (
        <Button variant="ghost" size="sm" onClick={() => fetchNextPage()}>
          Load more
        </Button>
      )}
    </div>
  );
}
