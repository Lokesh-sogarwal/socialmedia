import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Modal } from '../ui/Modal.jsx';
import { SearchBar } from '../SearchBar.jsx';
import { UserAvatar } from '../users/UserAvatar.jsx';
import { UserRowSkeleton } from '../ui/SkeletonLoader.jsx';
import { api } from '../../lib/api.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useToast } from '../../context/ToastContext.jsx';

export function NewMessageDialog({ onClose }) {
  const [q, setQ] = useState('');
  const term = useDebounce(q.trim(), 250);
  const navigate = useNavigate();
  const toast = useToast();
  const results = useQuery({ queryKey: ['search', 'users', term], queryFn: () => api.get('/search', { q: term, type: 'users' }), enabled: Boolean(term) });
  const start = useMutation({
    mutationFn: (userId) => api.post('/conversations', { userId }),
    onSuccess: (c) => {
      onClose();
      navigate(`/messages/${c._id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Modal title="New message" onClose={onClose} size="sm">
      <div className="p-5">
        <SearchBar value={q} onChange={setQ} placeholder="Search people" label="Search people to message" data-autofocus />
        <div className="mt-4 min-h-[8rem]">
          {results.isFetching && <UserRowSkeleton count={3} />}
          {term && results.isSuccess && results.data.filter((u) => !u.isSelf).length === 0 && <p className="py-6 text-center text-sm text-muted">No people found.</p>}
          <ul className="space-y-1">
            {results.data
              ?.filter((u) => !u.isSelf)
              .map((u) => (
                <li key={u._id}>
                  <button type="button" onClick={() => start.mutate(u._id)} disabled={start.isPending} className="flex w-full items-center gap-3 rounded-control px-2 py-2 text-left hover:bg-blush/40">
                    <UserAvatar user={u} size="md" />
                    <span>
                      <span className="block font-semibold">{u.displayName}</span>
                      <span className="block text-sm text-muted">@{u.username}</span>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
