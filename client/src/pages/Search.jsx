import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Hash, SearchX } from 'lucide-react';
import { api } from '../lib/api.js';
import { plural } from '../lib/format.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { SearchBar } from '../components/SearchBar.jsx';
import { UserCard } from '../components/users/UserCard.jsx';
import { PostCard } from '../components/posts/PostCard.jsx';
import { UserRowSkeleton } from '../components/ui/SkeletonLoader.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { SuggestedAccounts, TrendingHashtags } from '../components/layout/RightRail.jsx';

const TABS = [
  ['users', 'People'],
  ['hashtags', 'Hashtags'],
  ['posts', 'Posts'],
];

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const type = params.get('type') ?? 'users';
  const term = useDebounce(q.trim(), 250);
  const inputRef = useRef(null);
  useEffect(() => inputRef.current?.focus(), []);

  const query = useQuery({
    queryKey: ['search', type, term],
    queryFn: () => api.get('/search', { q: term, type }),
    enabled: term.length > 0,
    placeholderData: (prev) => prev,
  });

  const update = (next) => setParams((p) => ({ ...Object.fromEntries(p), ...next }), { replace: true });

  return (
    <div>
      <h1 className="sr-only">Search</h1>
      <div className="px-4 xs:px-0">
        <SearchBar ref={inputRef} value={q} onChange={(v) => update({ q: v })} placeholder="Search people, #hashtags or posts" />
        <div role="tablist" aria-label="Result type" className="mt-4 flex gap-2">
          {TABS.map(([value, label]) => (
            <button
              key={value}
              role="tab"
              type="button"
              aria-selected={type === value}
              onClick={() => update({ type: value })}
              className={clsx('rounded-full px-4 py-1.5 text-sm font-medium transition', type === value ? 'bg-rose text-charcoal' : 'bg-surface text-muted hover:bg-blush/50')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6" role="tabpanel">
        {!term && (
          <div className="space-y-5">
            <SuggestedAccounts />
            <TrendingHashtags />
          </div>
        )}
        {term && query.isPending && (
          <div className="card p-5">
            <UserRowSkeleton count={4} />
          </div>
        )}
        {term && query.isError && <ErrorState error={query.error} onRetry={query.refetch} />}
        {term && query.isSuccess && query.data.length === 0 && (
          <div className="card">
            <EmptyState icon={SearchX} title={`No results for “${term}”`} description="Check the spelling or try a different search." />
          </div>
        )}
        {term && query.isSuccess && query.data.length > 0 && type === 'users' && (
          <div className="card space-y-4 p-5">
            {query.data.map((u) => (
              <UserCard key={u._id} user={u} />
            ))}
          </div>
        )}
        {term && query.isSuccess && query.data.length > 0 && type === 'hashtags' && (
          <ul className="card divide-y divide-line">
            {query.data.map((t) => (
              <li key={t.tag}>
                <Link to={`/explore/tags/${encodeURIComponent(t.tag)}`} className="flex items-center gap-3 px-5 py-3 hover:bg-blush/30">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blush/70">
                    <Hash className="h-4 w-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-semibold">#{t.tag}</span>
                    <span className="block text-sm text-muted">{plural(t.posts, 'post')}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {term && query.isSuccess && query.data.length > 0 && type === 'posts' && (
          <div className="space-y-5">
            {query.data.map((p) => (
              <PostCard key={p._id} post={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
