'use client';

import { useState, FormEvent, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Input, Card } from '@shop/ui';
import Link from 'next/link';
import { useAuth } from '../../lib/auth/AuthContext';
import { useRouter } from 'next/navigation';
import { useTranslation } from '../../lib/i18n-client';

function LoginPageContent() {
  const { t } = useTranslation();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isLoading, isLoggedIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirect') || '/';

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    console.log('🔐 [LOGIN PAGE] Form submitted');

    // Validation
    if (!emailOrPhone.trim()) {
      setError(t('login.errors.emailOrPhoneRequired'));
      setIsSubmitting(false);
      return;
    }

    if (!password) {
      setError(t('login.errors.passwordRequired'));
      setIsSubmitting(false);
      return;
    }

    try {
      console.log('📤 [LOGIN PAGE] Calling login function...');
      await login(emailOrPhone.trim(), password);
      console.log('✅ [LOGIN PAGE] Login successful, redirecting to:', redirectTo);
      // Redirect to the specified page or home
      router.push(redirectTo);
    } catch (err: any) {
      console.error('❌ [LOGIN PAGE] Login error:', err);
      setError(err.message || t('login.errors.loginFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Redirect if already logged in
  useEffect(() => {
    if (isLoggedIn && !isLoading) {
      router.push(redirectTo);
    }
  }, [isLoggedIn, isLoading, redirectTo, router]);

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Card className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('login.title')}</h1>
        <p className="text-gray-600 mb-8">{t('login.subtitle')}</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="emailOrPhone" className="block text-sm font-medium text-gray-700 mb-2">
              {t('login.form.emailOrPhone')}
            </label>
            <Input
              id="emailOrPhone"
              type="text"
              placeholder={t('login.form.emailOrPhonePlaceholder')}
              className="w-full"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              disabled={isSubmitting || isLoading}
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              {t('login.form.password')}
            </label>
            <Input
              id="password"
              type="password"
              placeholder={t('login.form.passwordPlaceholder')}
              className="w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting || isLoading}
              required
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                disabled={isSubmitting || isLoading}
              />
              <span className="ml-2 text-sm text-gray-600">{t('login.form.rememberMe')}</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-blue-600 hover:underline"
            >
              {t('login.form.forgotPassword')}
            </Link>
          </div>
          <Button 
            variant="primary" 
            className="w-full"
            type="submit"
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting || isLoading ? t('login.form.submitting') : t('login.form.submit')}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            {t('login.form.noAccount')}{' '}
            <Link href="/register" className="text-blue-600 hover:underline font-medium">
              {t('login.form.signUp')}
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="space-y-4">
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </div>
          </div>
        </Card>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}

