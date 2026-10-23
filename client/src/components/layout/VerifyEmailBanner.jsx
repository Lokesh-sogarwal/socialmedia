import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export function VerifyEmailBanner() {
  const { user } = useAuth();
  const toast = useToast();
  const [hidden, setHidden] = useState(false);
  const [sending, setSending] = useState(false);
  if (!user || user.emailVerified || hidden) return null;

  async function resend() {
    setSending(true);
    try {
      await api.post('/auth/resend-verification');
      toast.success(`Verification link sent to ${user.email}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex items-center gap-3 border-b border-line bg-blush/60 px-4 py-2 text-sm">
      <MailCheck className="h-4 w-4 shrink-0" aria-hidden />
      <p className="flex-1">Please verify your email address to secure your account.</p>
      <button type="button" onClick={resend} disabled={sending} className="font-semibold underline-offset-2 hover:underline disabled:opacity-60">
        Resend link
      </button>
      <button type="button" onClick={() => setHidden(true)} className="text-muted hover:text-charcoal" aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
