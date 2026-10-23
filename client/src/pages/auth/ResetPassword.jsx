import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthLayout } from './AuthLayout.jsx';
import { TextField } from '../../components/ui/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { api } from '../../lib/api.js';
import { passwordRule } from '../../lib/validation.js';

const schema = z
  .object({ password: passwordRule, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ password }) => {
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError('root', { message: err.message });
    }
  });

  const login = (
    <Link to="/login" className="font-semibold text-charcoal hover:underline">
      Go to log in
    </Link>
  );
  if (!token) {
    return (
      <AuthLayout title="Link not valid" subtitle="This reset link is missing its token. Request a new one." footer={login}>
        <Link to="/forgot-password">
          <Button className="w-full">Request a new link</Button>
        </Link>
      </AuthLayout>
    );
  }
  if (done) {
    return <AuthLayout title="Password updated" subtitle="You’ve been signed out everywhere. Log in with your new password." footer={login} />;
  }
  return (
    <AuthLayout title="Choose a new password" footer={login}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <TextField label="New password" type="password" autoComplete="new-password" autoFocus error={errors.password?.message} {...register('password')} />
        <TextField label="Confirm password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        {errors.root && <p className="field-error" role="alert">{errors.root.message}</p>}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
