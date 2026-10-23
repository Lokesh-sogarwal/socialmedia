import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import clsx from 'clsx';
import { AuthLayout } from './AuthLayout.jsx';
import { TextField } from '../../components/ui/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { applyServerErrors, passwordRule, passwordStrength, usernameRule } from '../../lib/validation.js';

const schema = z
  .object({
    displayName: z.string().trim().min(1, 'Enter your name').max(50),
    username: usernameRule,
    email: z.string().trim().email('Enter a valid email'),
    password: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

export default function Signup() {
  const { register: signup } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), mode: 'onTouched' });
  const strength = passwordStrength(watch('password'));

  const onSubmit = handleSubmit(async ({ confirmPassword: _c, ...values }) => {
    try {
      await signup(values);
    } catch (err) {
      applyServerErrors(err, setError);
    }
  });

  return (
    <AuthLayout
      title="Create your account"
      subtitle="It only takes a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-charcoal underline-offset-2 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <TextField label="Name" autoComplete="name" autoFocus error={errors.displayName?.message} {...register('displayName')} />
        <TextField label="Username" autoComplete="username" autoCapitalize="none" error={errors.username?.message} {...register('username')} />
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <div>
          <TextField label="Password" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
          <div className="mt-2 flex items-center gap-2" aria-live="polite">
            <div className="flex flex-1 gap-1" aria-hidden>
              {[1, 2, 3].map((i) => (
                <span key={i} className={clsx('h-1.5 flex-1 rounded-full', strength.score >= i ? 'bg-rose-deep' : 'bg-blush')} />
              ))}
            </div>
            <span className="w-20 text-right text-xs text-muted">{strength.label}</span>
          </div>
        </div>
        <TextField label="Confirm password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        {errors.root && (
          <p className="rounded-control bg-blush/70 px-3 py-2 text-sm text-danger" role="alert">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Sign up
        </Button>
      </form>
    </AuthLayout>
  );
}
