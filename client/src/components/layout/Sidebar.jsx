import { NavLink, useNavigate } from 'react-router';
import clsx from 'clsx';
import { LogOut, MoreHorizontal, PlusSquare } from 'lucide-react';
import { Logo } from './Logo.jsx';
import { Badge } from './Badge.jsx';
import { MODERATION_NAV, PRIMARY_NAV } from './navItems.js';
import { UserAvatar } from '../users/UserAvatar.jsx';
import { DropdownMenu } from '../ui/DropdownMenu.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useComposer } from '../../context/ComposerContext.jsx';
import { useBadges } from '../../hooks/useBadges.js';

function navClass({ isActive }) {
  return clsx(
    'group flex items-center gap-4 rounded-control px-3 py-2.5 transition md:justify-center lg:justify-start',
    isActive ? 'bg-rose/45 font-semibold' : 'hover:bg-blush/50',
  );
}

/** Desktop/tablet navigation: icons only on tablets, labelled on laptops and up. */
export function Sidebar() {
  const { user, logout } = useAuth();
  const { openPost } = useComposer();
  const badges = useBadges();
  const navigate = useNavigate();
  const items = ['moderator', 'admin'].includes(user?.role) ? [...PRIMARY_NAV, MODERATION_NAV] : PRIMARY_NAV;

  return (
    <aside className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col border-r border-line bg-surface/70 px-3 py-5 backdrop-blur md:flex lg:w-sidebar">
      <div className="mb-6 px-2 md:flex md:justify-center lg:block">
        <Logo compact className="lg:hidden" />
        <Logo className="hidden lg:inline-flex" />
      </div>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={navClass} title={item.label}>
            <span className="relative">
              <item.icon className="h-6 w-6" aria-hidden />
              {item.badge && <Badge count={badges[item.badge]} className="absolute -right-2 -top-2" />}
            </span>
            <span className="md:sr-only lg:not-sr-only">{item.label}</span>
          </NavLink>
        ))}
        <button type="button" onClick={() => openPost()} className={navClass({ isActive: false })} title="Create post">
          <PlusSquare className="h-6 w-6" aria-hidden />
          <span className="md:sr-only lg:not-sr-only">Create</span>
        </button>
        <NavLink to={`/u/${user.username}`} className={navClass} title="Profile">
          <UserAvatar user={user} size="xs" className="h-6 w-6" />
          <span className="md:sr-only lg:not-sr-only">Profile</span>
        </NavLink>
      </nav>
      <div className="mt-4 hidden items-center gap-3 rounded-control border border-line bg-surface p-2.5 lg:flex">
        <UserAvatar user={user} size="sm" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold">{user.displayName}</p>
          <p className="truncate text-xs text-muted">@{user.username}</p>
        </div>
        <DropdownMenu
          label="Account menu"
          side="top"
          trigger={<MoreHorizontal className="h-5 w-5" />}
          items={[
            { label: 'Settings', onSelect: () => navigate('/settings') },
            { label: 'Log out', icon: LogOut, onSelect: logout },
          ]}
        />
      </div>
      <button type="button" onClick={logout} className={clsx(navClass({ isActive: false }), 'lg:hidden')} title="Log out">
        <LogOut className="h-6 w-6" aria-hidden />
        <span className="sr-only">Log out</span>
      </button>
    </aside>
  );
}
