'use client';

import { SWRConfig } from 'swr';
import NextTopLoader from 'nextjs-toploader';
import { Toaster } from '@/components/ui/sonner';
import { SessionProvider } from '@/components/providers/session-provider';
import { PermissionProvider } from '@/components/Security/PermissionProvider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import type { Session } from '@/lib/auth/types';
import type { ReactNode } from 'react';

interface RootProvidersProps {
  children: ReactNode;
  initialSession?: Session | null;
}

export default function RootProviders({ children, initialSession }: RootProvidersProps) {
  return (
    <SWRConfig
      value={{
        dedupingInterval: 60_000,
        focusThrottleInterval: 60_000,
        onErrorRetry: (_error, _key, _config, revalidate, { retryCount }) => {
          if (retryCount >= 3) return;
          setTimeout(() => revalidate({ retryCount }), 5_000);
        },
      }}
    >
      <SessionProvider initialSession={initialSession}>
        <PermissionProvider>
          <ThemeProvider>
            <NextTopLoader showSpinner={false} />
            {children}
            <Toaster />
          </ThemeProvider>
        </PermissionProvider>
      </SessionProvider>
    </SWRConfig>
  );
}
