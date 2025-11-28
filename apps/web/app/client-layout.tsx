'use client';

import PlatformSessionProvider, { usePlatformSession } from '@components/Contexts/LHSessionContext';
import StyledComponentsRegistry from '../components/Utils/libs/styled-registry';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { updateUserTheme } from '@services/users/users';
import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { SWRConfig } from 'swr';

interface ClientLayoutProps {
  children: ReactNode;
}

function ThemeSync() {
  const session = usePlatformSession() as any;
  useEffect(() => {
    const handleThemeChange = async (event: Event) => {
      const customEvent = event as CustomEvent<{ theme: string }>;
      if (session?.data?.user?.id && session?.data?.tokens?.access_token) {
        try {
          // Update theme on server without refreshing session (avoid unnecessary re-renders)
          await updateUserTheme(session.data.user.id, customEvent.detail.theme, session.data.tokens.access_token);
        } catch (error) {
          console.error('Failed to sync theme to server:', error);
        }
      }
    };

    window.addEventListener('themeChange', handleThemeChange);
    return () => {
      window.removeEventListener('themeChange', handleThemeChange);
    };
  }, [session]);

  return null;
}

function ServiceWorkerCleanup() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    // Unregister any legacy service workers that might still be controlling
    // this origin (from older deployments that used /sw.js and request-throttler.js).
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const registration of registrations) {
          registration.unregister().catch(() => {
            // Ignore errors – cleanup is best-effort only.
          });
        }
      })
      .catch(() => {
        // Ignore errors – if cleanup fails, normal navigation still works.
      });
  }, []);

  return null;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    // Lower frequency of session refetches to avoid unnecessary periodic calls that
    // may contribute to being rate limited. Also disable refetch on window focus.
    <SessionProvider
      refetchInterval={5 * 60_000} // 5 minutes
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      <PlatformSessionProvider>
        {/* Global SWR defaults to reduce frequent revalidation and dedupe identical requests. */}
        <SWRConfig
          value={{
            dedupingInterval: 60_000, // dedupe identical requests for 60s
            focusThrottleInterval: 60_000, // throttle refetches on focus
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            shouldRetryOnError: false,
            errorRetryCount: 1,
          }}
        >
          <ServiceWorkerCleanup />
          <ThemeProviderWrapper>{children}</ThemeProviderWrapper>
        </SWRConfig>
      </PlatformSessionProvider>
    </SessionProvider>
  );
}

function ThemeProviderWrapper({ children }: { children: ReactNode }) {
  const session = usePlatformSession() as any;
  const userTheme = session?.data?.user?.theme;

  return (
    <ThemeProvider userTheme={userTheme}>
      <ThemeSync />
      <StyledComponentsRegistry>
        <main className="animate-fade-in">{children}</main>
      </StyledComponentsRegistry>
    </ThemeProvider>
  );
}
