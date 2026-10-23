import { Heart, MessageCircle, Sparkles } from 'lucide-react';
import { Logo } from '../../components/layout/Logo.jsx';

export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-dvh">
      <section className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-blush p-12 lg:flex" aria-hidden>
        <Logo />
        <div className="max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">Share the little moments with the people who matter.</h2>
          <ul className="mt-8 space-y-4 text-base">
            <li className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface">
                <Sparkles className="h-5 w-5" />
              </span>
              Photos, videos and stories that last a day
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface">
                <MessageCircle className="h-5 w-5" />
              </span>
              Real-time messages with friends
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface">
                <Heart className="h-5 w-5" />
              </span>
              Private accounts and controls you choose
            </li>
          </ul>
        </div>
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-rose/50" />
        <p className="relative text-sm text-muted">© {new Date().getFullYear()} Socio</p>
      </section>
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
