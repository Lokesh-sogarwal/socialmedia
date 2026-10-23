import { forwardRef } from 'react';
import { Search, X } from 'lucide-react';

export const SearchBar = forwardRef(function SearchBar({ value, onChange, placeholder = 'Search', label = 'Search', ...props }, ref) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="input h-12 rounded-full pl-11 pr-10 [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted hover:bg-blush/60" aria-label="Clear search">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
});
