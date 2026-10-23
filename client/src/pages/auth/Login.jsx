import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthLayout } from './AuthLayout.jsx';
import { TextField } from '../../components/ui/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const schema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or username'),
  password: z.string().min(1, 'Enter your password'),
});

export default function Login() {
  const { login } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login(values);
    } catch (err) {
      setError('root', { message: err.message });
    }
  });

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to see what your friends are sharing."
      footer={
        <>
          New to Socio?{' '}
          <Link to="/signup" className="font-semibold text-charcoal underline-offset-2 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <TextField label="Email or username" autoComplete="username" autoFocus error={errors.identifier?.message} {...register('identifier')} />
        <TextField label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-muted hover:text-charcoal hover:underline">
            Forgot password?
          </Link>
        </div>
        {errors.root && (
          <p className="rounded-control bg-blush/70 px-3 py-2 text-sm text-danger" role="alert">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}
