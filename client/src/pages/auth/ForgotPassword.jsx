import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MailCheck } from 'lucide-react';
import { AuthLayout } from './AuthLayout.jsx';
import { TextField } from '../../components/ui/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { api } from '../../lib/api.js';

const schema = z.object({ email: z.string().trim().email('Enter a valid email') });

export default function ForgotPassword() {
  const [sentTo, setSentTo] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    try {
      await api.post('/auth/forgot-password', { email });
      setSentTo(email);
    } catch (err) {
      setError('root', { message: err.message });
    }
  });

  const back = (
    <Link to="/login" className="font-semibold text-charcoal hover:underline">
      Back to log in
    </Link>
  );

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" footer={back}>
        <div className="card flex gap-3 p-5">
          <MailCheck className="h-6 w-6 shrink-0" aria-hidden />
          <p className="text-sm">
            If an account exists for <strong>{sentTo}</strong>, we’ve sent a link to reset your password. It expires in one hour.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset your password" subtitle="Enter the email you signed up with and we’ll send you a reset link." footer={back}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <TextField label="Email" type="email" autoComplete="email" autoFocus error={errors.email?.message} {...register('email')} />
        {errors.root && <p className="field-error" role="alert">{errors.root.message}</p>}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  );
}
