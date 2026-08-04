import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../auth';
import { STATIC_USERS } from '../auth';
import { Button } from '../components/ui/Button';
import { BuildingOfficeIcon, ChartBarIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

interface LoginFormData {
  email: string;
  password: string;
}

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const onSubmit = (data: LoginFormData) => {
    setError(null);
    const success = login(data.email, data.password);
    if (success) {
      navigate('/');
    } else {
      setError('Invalid email or password');
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left side - Illustration / branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden bg-brand-600">
        {/* Background pattern */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 h-[600px] w-[600px] rounded-full bg-brand-500/30 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-[500px] w-[500px] rounded-full bg-brand-700/40 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-white/5 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <span className="text-lg font-bold text-white">E</span>
            </div>
            <span className="text-2xl font-semibold text-white">
              Enquiry<span className="text-brand-200">Hub</span>
            </span>
          </div>

          {/* Feature highlights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-8"
          >
            <h2 className="text-3xl font-bold text-white xl:text-4xl leading-tight">
              Manage property enquiries
              <br />
              with confidence
            </h2>
            <div className="space-y-5">
              <FeatureItem
                icon={<BuildingOfficeIcon className="h-5 w-5" />}
                title="Property Sync"
                description="Automatic WordPress integration keeps listings up to date"
              />
              <FeatureItem
                icon={<ChartBarIcon className="h-5 w-5" />}
                title="Real-time Metrics"
                description="Track enquiry volume, response times, and conversion rates"
              />
              <FeatureItem
                icon={<ShieldCheckIcon className="h-5 w-5" />}
                title="GDPR Built-in"
                description="Consent tracking, data export, and erasure in one click"
              />
            </div>
          </motion.div>

          {/* Footer */}
          <p className="text-sm text-brand-200">
            &copy; {new Date().getFullYear()} EnquiryHub. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex w-full items-center justify-center px-4 py-12 lg:w-1/2 xl:w-[45%]">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600">
                <span className="text-base font-bold text-white">E</span>
              </div>
              <span className="text-xl font-semibold text-surface-900">
                Enquiry<span className="text-brand-600">Hub</span>
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-surface-900 sm:text-3xl">Welcome back</h1>
            <p className="text-surface-500">Sign in to access your dashboard</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {error}
              </motion.div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-surface-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="block w-full rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Enter a valid email address',
                  },
                })}
              />
              {errors.email && (
                <p className="mt-1.5 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-surface-700 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                className="block w-full rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm text-surface-900 placeholder:text-surface-400 transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                {...register('password', {
                  required: 'Password is required',
                })}
              />
              {errors.password && (
                <p className="mt-1.5 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" loading={isSubmitting} fullWidth size="lg" className="mt-2">
              Sign In
            </Button>
          </form>

          {/* Test credentials */}
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
            <h3 className="text-sm font-semibold text-amber-800">Demo Credentials</h3>
            <div className="mt-3 space-y-2">
              {STATIC_USERS.map((user) => (
                <div key={user.id} className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    {user.role}
                  </span>
                  <span className="font-mono text-xs text-amber-700">
                    {user.email} / {user.password}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-sm">
        {icon}
      </div>
      <div>
        <p className="font-medium text-white">{title}</p>
        <p className="text-sm text-brand-200">{description}</p>
      </div>
    </div>
  );
}
