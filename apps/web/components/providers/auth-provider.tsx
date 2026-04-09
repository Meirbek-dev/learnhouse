'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { subscribeToAuthInvalidation } from '@/lib/auth/broadcast';
import { buildLoginRedirect } from '@/lib/auth/redirect';
import { AUTH_SESSION_SWR_KEY } from '@/lib/auth/constants';
import type { ReactNode } from 'react';
import { isAuthRoute, isProtectedRoute } from '@/lib/auth/routes';

function useAuthBroadcast(): void {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const lastNonce = useRef<string | null>(null);

  useEffect(() => {
    return subscribeToAuthInvalidation((msg) => {
      if (msg.nonce && msg.nonce === lastNonce.current) return;
      lastNonce.current = msg.nonce;

      void mutate(AUTH_SESSION_SWR_KEY, null, { revalidate: false });

      if (msg.reason === 'expired') {
        toast.error('Session expired. Please sign in again.');
      } else if (msg.reason === 'revoked') {
        toast.error('Your session was revoked.');
      } else if (msg.reason === 'network_recovery_failed') {
        toast.error('Could not recover your session.');
      }

      if (msg.redirectTo) {
        window.location.href = msg.redirectTo;
        return;
      }

      const { pathname } = window.location;

      if (msg.reason === 'logged_out') {
        // Soft refresh is enough — middleware handles redirect if needed.
        router.refresh();
        return;
      }

      if (msg.reason === 'unauthenticated' && (!isProtectedRoute(pathname) || isAuthRoute(pathname))) {
        router.refresh();
        return;
      }

      // For expired/revoked/unauthenticated on protected routes: hard redirect with returnTo.
      if (!isAuthRoute(pathname)) {
        window.location.href = buildLoginRedirect(msg.returnTo);
      }
    });
  }, [mutate, router]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  useAuthBroadcast();
  return <>{children}</>;
}
