import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';

export function PageHeader({ title, subtitle, back = false, actions }) {
  const navigate = useNavigate();
  return (
    <div className="mb-5 flex items-center gap-3 px-4 xs:px-0">
      {back && (
        <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} className="-ml-2 rounded-full p-2 hover:bg-blush/60" aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
