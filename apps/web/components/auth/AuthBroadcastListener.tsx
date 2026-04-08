'use client';

import { AUTH_SESSION_SWR_KEY } from '@/lib/auth/constants';
import { buildLoginRedirect, isAuthRoute, isProtectedRoute, subscribeToAuthInvalidation } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { useSWRConfig } from 'swr';
import { toast } from 'sonner';

export function AuthBroadcastListener() {
  const router = useRouter();
  const t = useTranslations('Auth.Login');
  const { mutate } = useSWRConfig();
  const lastInvalidationNonceRef = useRef<string | null>(null);

  useEffect(() => {
    return subscribeToAuthInvalidation((detail) => {
      if (detail.nonce && detail.nonce === lastInvalidationNonceRef.current) {
        return;
      }

      lastInvalidationNonceRef.current = detail.nonce ?? null;

      void mutate(AUTH_SESSION_SWR_KEY, null, { revalidate: false });
      router.refresh();

      const pathname = globalThis.location.pathname;
      const onAuthRoute = isAuthRoute(pathname);
      const onProtectedRoute = isProtectedRoute(pathname);

      if (detail.reason === 'expired') {
        toast.error(t('sessionExpired'));
      } else if (detail.reason === 'revoked') {
        toast.error(t('sessionRevoked'));
      } else if (detail.reason === 'network_recovery_failed') {
        toast.error(t('sessionRecoveryFailed'));
      }

      if (detail.redirectTo) {
        globalThis.location.href = detail.redirectTo;
        return;
      }

      if (detail.reason === 'unauthenticated') {
        if (onProtectedRoute && !onAuthRoute) {
          globalThis.location.href = buildLoginRedirect(detail.returnTo);
        }
        return;
      }

      if (!onAuthRoute && detail.reason !== 'logged_out') {
        globalThis.location.href = buildLoginRedirect(detail.returnTo);
      }
    });
  }, [mutate, router, t]);

  return null;
}
