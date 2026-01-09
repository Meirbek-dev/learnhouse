'use client';

import PlatformSessionProvider, { usePlatformSession } from '@components/Contexts/LHSessionContext';
import StyledComponentsRegistry from '../components/Utils/libs/styled-registry';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { swrFetcher } from '@services/utils/ts/requests';
import { updateUserTheme } from '@services/users/users';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from '@/components/ui/sonner';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';

interface ClientLayoutProps {
  children: ReactNode;
}

function ThemeSync() {
  const session = usePlatformSession() as any;
  const sessionRef = useRef(session);

  // Keep a ref to the latest session so the event listener doesn't need to be
  // re-attached every time the session object identity changes.
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ theme?: string }>;
      const theme = customEvent?.detail?.theme;
      if (!theme) return;
      const s = sessionRef.current;
      if (s?.data?.user?.id && s?.data?.tokens?.access_token) {
        // Fire-and-forget and surface failures to console to avoid unhandled rejections
        updateUserTheme(s.data.user.id, theme, s.data.tokens.access_token).catch((error) =>
          console.error('Failed to sync theme to server:', error),
        );
      }
    };

    window.addEventListener('themeChange', handleThemeChange);
    return () => {
      window.removeEventListener('themeChange', handleThemeChange);
    };
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
            // Use the central swrFetcher which accepts (url, token)
            fetcher: (url: string, token?: string) => swrFetcher(url, token),
            dedupingInterval: 60_000, // dedupe identical requests for 60s
            focusThrottleInterval: 60_000, // throttle refetches on focus
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            shouldRetryOnError: true,
            errorRetryCount: 3,
            // Respect upstream Retry-After when available (e.g., 429 from nginx)
            onErrorRetry: (error: any, key, config, revalidate, { retryCount }: any) => {
              // Do not retry more than configured
              if (retryCount >= (config.errorRetryCount ?? 3)) return;

              // If server provided Retry-After header, respect it
              const retryAfter = error?.retryAfter;
              if (retryAfter) {
                // Retry-After may be seconds (numeric) or HTTP-date
                const parsed = Number(retryAfter);
                if (Number.isFinite(parsed) && parsed >= 0) {
                  setTimeout(() => revalidate({ retryCount }), parsed * 1000 + Math.floor(Math.random() * 300));
                  return;
                }
                const parsedDate = Date.parse(retryAfter);
                if (!isNaN(parsedDate)) {
                  const wait = Math.max(parsedDate - Date.now(), 0);
                  setTimeout(() => revalidate({ retryCount }), Math.min(wait, 60_000) + Math.floor(Math.random() * 300));
                  return;
                }
              }

              // Fallback exponential backoff with jitter
              const backoff = Math.min(1000 * 2 ** retryCount, 30_000);
              setTimeout(() => revalidate({ retryCount }), backoff + Math.floor(Math.random() * Math.floor(backoff * 0.3)));
            },
          }}
        >
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
        <Toaster />
      </StyledComponentsRegistry>
    </ThemeProvider>
  );
}
