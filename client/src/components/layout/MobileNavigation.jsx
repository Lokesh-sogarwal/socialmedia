import { NavLink } from 'react-router';
import clsx from 'clsx';
import { Bell, Clapperboard, Home, MessageCircle, Plus, Search } from 'lucide-react';
import { Logo } from './Logo.jsx';
import { Badge } from './Badge.jsx';
import { UserAvatar } from '../users/UserAvatar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useComposer } from '../../context/ComposerContext.jsx';
import { useBadges } from '../../hooks/useBadges.js';

export function TopBar() {
  const badges = useBadges();
  const iconLink = ({ isActive }) => clsx('relative rounded-full p-2', isActive ? 'bg-rose/45' : 'hover:bg-blush/60');
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-background/90 px-4 backdrop-blur md:hidden">
      <Logo />
      <nav aria-label="Inbox" className="flex items-center gap-1">
        <NavLink to="/notifications" className={iconLink} aria-label="Notifications">
          <Bell className="h-6 w-6" />
          <Badge count={badges.notifications} className="absolute right-0 top-0" />
        </NavLink>
        <NavLink to="/messages" className={iconLink} aria-label="Messages">
          <MessageCircle className="h-6 w-6" />
          <Badge count={badges.messages} className="absolute right-0 top-0" />
        </NavLink>
      </nav>
    </header>
  );
}

export function MobileNavigation() {
  const { user } = useAuth();
  const { openPost } = useComposer();
  const item = ({ isActive }) =>
    clsx('flex h-12 w-12 items-center justify-center rounded-full transition', isActive ? 'bg-rose/45' : 'active:bg-blush/60');
  return (
    <nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden"
    >
      <div className="mx-auto flex h-[var(--height-mobile-nav)] max-w-md items-center justify-around px-2">
        <NavLink to="/" end className={item} aria-label="Home">
          <Home className="h-6 w-6" />
        </NavLink>
        <NavLink to="/search" className={item} aria-label="Search">
          <Search className="h-6 w-6" />
        </NavLink>
        <button
          type="button"
          onClick={() => openPost()}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose text-charcoal shadow-card active:bg-rose/80"
          aria-label="Create post"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>
        <NavLink to="/reels" className={item} aria-label="Reels">
          <Clapperboard className="h-6 w-6" />
        </NavLink>
        <NavLink to={`/u/${user.username}`} className={item} aria-label="Your profile">
          <UserAvatar user={user} size="xs" />
        </NavLink>
      </div>
    </nav>
  );
}
