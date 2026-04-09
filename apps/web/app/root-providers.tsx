'use client';

import { SWRConfig } from 'swr';
import NextTopLoader from 'nextjs-toploader';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/components/providers/auth-provider';
import { PermissionProvider } from '@/components/Security/PermissionProvider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { AUTH_SESSION_SWR_KEY } from '@/lib/auth/constants';
import type { Session } from '@/lib/auth/types';
import type { ReactNode } from 'react';

interface RootProvidersProps {
  children: ReactNode;
  initialSession?: Session | null;
}

export default function RootProviders({ children, initialSession }: RootProvidersProps) {
  const fallback = initialSession !== undefined ? { [AUTH_SESSION_SWR_KEY]: initialSession } : undefined;

  return (
    <SWRConfig
      value={{
        fallback,
        dedupingInterval: 60_000,
        focusThrottleInterval: 60_000,
        onErrorRetry: (error, _key, _config, revalidate, { retryCount }) => {
          if (error?.status === 401) return;
          if (retryCount >= 3) return;
          setTimeout(() => revalidate({ retryCount }), 5_000);
        },
      }}
    >
      <AuthProvider>
        <PermissionProvider>
          <ThemeProvider>
            <NextTopLoader showSpinner={false} />
            {children}
            <Toaster />
          </ThemeProvider>
        </PermissionProvider>
      </AuthProvider>
    </SWRConfig>
  );
}
