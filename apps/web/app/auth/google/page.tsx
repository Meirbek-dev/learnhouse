'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Loader2, AlertTriangle } from 'lucide-react';
import AuthCard from '@components/auth/card';
import AuthLogo from '@components/auth/logo';
import { getAbsoluteUrl } from '@services/config/config';
import { useTranslations } from 'next-intl';
import Link from '@components/ui/AppLink';

/**
 * Google OAuth callback page.
 *
 * After the backend completes the Authorization Code flow with Google, it
 * redirects here with either:
 *   - ?code=<exchange_code>  — success; exchange the code for a NextAuth session
 *   - ?error=<reason>        — failure; show an error and offer a retry link
 */
const GoogleCallbackPage = () => {
  const searchParams = useSearchParams();
  const t = useTranslations('Auth.Login');
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const oauthError = searchParams.get('error');

    if (oauthError || !code) {
      setError(t('wrongCredentials'));
      return;
    }

    // Exchange the backend-issued code for a NextAuth session.
    // The 'google-exchange' credentials provider calls POST /auth/google/exchange.
    signIn('google-exchange', {
      exchange_code: code,
      redirect: false,
    }).then((result) => {
      if (result?.error) {
        setError(t('wrongCredentials'));
        return;
      }
      if (result?.ok) {
        globalThis.location.href = '/redirect_from_auth';
      }
    });
  }, [searchParams, t]);

  return (
    <AuthCard>
      <Link prefetch={false} href={getAbsoluteUrl('/')}>
        <AuthLogo />
      </Link>

      <div className="mt-8 flex flex-col items-center gap-4">
        {error ? (
          <>
            <div className="flex w-full items-center gap-2 rounded-md bg-red-200 p-3 text-red-950">
              <AlertTriangle size={18} />
              <span className="text-sm font-semibold">{error}</span>
            </div>
            <Link
              prefetch={false}
              href={getAbsoluteUrl('/login')}
              className="text-muted-foreground text-sm underline"
            >
              {t('login')}
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-muted-foreground text-sm">{t('loading')}</p>
          </>
        )}
      </div>
    </AuthCard>
  );
};

export default GoogleCallbackPage;
