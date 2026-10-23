import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CheckCircle2, XCircle } from 'lucide-react';
import { AuthLayout } from './AuthLayout.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const { status: authStatus, refreshUser } = useAuth();
  const [state, setState] = useState({ status: 'pending' });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // tokens are single-use; avoid StrictMode double-submit
    started.current = true;
    const token = params.get('token');
    if (!token) {
      setState({ status: 'error', message: 'This link is missing its token.' });
      return;
    }
    api
      .post('/auth/verify-email', { token })
      .then(() => setState({ status: 'ok' }))
      .catch((err) => setState({ status: 'error', message: err.message }));
  }, [params]);

  useEffect(() => {
    if (state.status === 'ok' && authStatus === 'authenticated') refreshUser().catch(() => {});
  }, [state.status, authStatus, refreshUser]);

  const next = (
    <Link to={authStatus === 'authenticated' ? '/' : '/login'} className="font-semibold text-charcoal hover:underline">
      {authStatus === 'authenticated' ? 'Continue to Socio' : 'Go to log in'}
    </Link>
  );
  return (
    <AuthLayout title="Email verification" footer={state.status !== 'pending' && next}>
      <div className="card flex items-center gap-3 p-5" role="status">
        {state.status === 'pending' && (
          <>
            <Spinner /> Verifying your email…
          </>
        )}
        {state.status === 'ok' && (
          <>
            <CheckCircle2 className="h-6 w-6 text-rose-deep" aria-hidden /> Your email is verified. Thanks!
          </>
        )}
        {state.status === 'error' && (
          <>
            <XCircle className="h-6 w-6 text-danger" aria-hidden /> {state.message}
          </>
        )}
      </div>
    </AuthLayout>
  );
}
