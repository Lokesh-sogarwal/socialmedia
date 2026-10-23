import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router';
import clsx from 'clsx';
import { Sidebar } from './Sidebar.jsx';
import { MobileNavigation, TopBar } from './MobileNavigation.jsx';
import { RightRail } from './RightRail.jsx';
import { FullPageSpinner } from '../ui/Spinner.jsx';
import { VerifyEmailBanner } from './VerifyEmailBanner.jsx';

// Full-bleed pages manage their own width and hide the discovery rail.
const WIDE = [/^\/messages/, /^\/reels/, /^\/explore$/, /^\/moderation/, /^\/u\//, /^\/p\//];

export function AppLayout() {
  const { pathname } = useLocation();
  const wide = WIDE.some((re) => re.test(pathname));
  const immersive = /^\/messages\/.+/.test(pathname);
  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:shadow-pop">
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {!immersive && <TopBar />}
        <VerifyEmailBanner />
        <div className="flex flex-1 justify-center">
          <main
            id="main"
            className={clsx(
              'min-w-0 flex-1',
              wide ? 'max-w-5xl' : 'max-w-feed',
              immersive ? 'md:px-0' : 'px-0 pb-[calc(var(--height-mobile-nav)+1.5rem)] pt-4 xs:px-4 md:px-6 md:pb-10 md:pt-8',
            )}
          >
            <Suspense fallback={<FullPageSpinner />}>
              <Outlet />
            </Suspense>
          </main>
          {!wide && <RightRail />}
        </div>
      </div>
      {!immersive && <MobileNavigation />}
    </div>
  );
}
