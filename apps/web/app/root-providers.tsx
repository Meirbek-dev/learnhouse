'use client';

import { AuthBroadcastListener } from '@/components/auth/AuthBroadcastListener';
import { ThemeProvider, useTheme } from '@/components/providers/theme-provider';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthStatus } from '@/hooks/useSession';
import { AUTH_SESSION_SWR_KEY } from '@/lib/auth/constants';
import type { Session } from '@/lib/auth/types';
import { swrFetcher } from '@services/utils/ts/requests';
import NextTopLoader from 'nextjs-toploader';
import { Toaster } from '@/components/ui/sonner';
import { SWRConfig } from 'swr';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface RootProvidersProps {
  children: ReactNode;
  initialSession?: Session | null;
}

function AppSWRProvider({ children, initialSession }: { children: ReactNode; initialSession?: Session | null }) {
  const fallback = initialSession === undefined ? undefined : { [AUTH_SESSION_SWR_KEY]: initialSession };

  return (
    <SWRConfig
      value={{
        fallback,
        dedupingInterval: 60_000,
        fetcher: (url: string) => swrFetcher(url),
        focusThrottleInterval: 60_000,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        onErrorRetry: (error, _key, _config, revalidate, { retryCount }) => {
          if (error?.status === 401) return;
          if (retryCount >= 3) return;
          setTimeout(() => revalidate({ retryCount }), 5000);
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}

function RootProgressBar() {
  const { theme: currentTheme } = useTheme();

  return (
    <NextTopLoader
      color={currentTheme.colors.primary}
      crawl
      crawlSpeed={300}
      easing="ease"
      height={3}
      initialPosition={0.1}
      shadow={`0 0 10px ${currentTheme.colors.primary}, 0 0 5px ${currentTheme.colors.primary}`}
      showSpinner={false}
      speed={1000}
    />
  );
}

function UserThemeSync() {
  const status = useAuthStatus();
  const currentUser = useCurrentUser();
  const { themeName } = useTheme();
  const pendingThemeRef = useRef<string | null>(null);
  const syncedThemeRef = useRef(currentUser?.theme ?? null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = currentUser?.id;
  const isAuthenticated = status === 'authenticated';

  useEffect(() => {
    syncedThemeRef.current = currentUser?.theme ?? null;
    pendingThemeRef.current = null;
  }, [currentUser?.id, currentUser?.theme]);

  useEffect(() => {
    if (!userId || !isAuthenticated) {
      pendingThemeRef.current = null;
      return;
    }

    if (themeName === syncedThemeRef.current) {
      pendingThemeRef.current = null;
      return;
    }

    pendingThemeRef.current = themeName;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = globalThis.setTimeout(() => {
      const nextTheme = pendingThemeRef.current;
      if (!nextTheme) {
        return;
      }

      void fetch('/api/user/theme', {
        body: JSON.stringify({ theme: nextTheme }),
        headers: {
          'Content-Type': 'application/json',
        },
        keepalive: true,
        method: 'POST',
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Theme sync failed with status ${response.status}`);
          }

          syncedThemeRef.current = nextTheme;
          pendingThemeRef.current = null;
        })
        .catch((error: unknown) => {
          console.error('Failed to sync theme to server:', error);
        });
    }, 1000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isAuthenticated, themeName, userId]);

  useEffect(() => {
    if (!userId || !isAuthenticated) {
      return;
    }

    const handleBeforeUnload = () => {
      if (!pendingThemeRef.current) {
        return;
      }

      const payload = JSON.stringify({ theme: pendingThemeRef.current });
      const body = new Blob([payload], { type: 'application/json' });

      navigator.sendBeacon('/api/user/theme', body);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isAuthenticated, userId]);

  return null;
}

function ThemeProviderWrapper({ children }: { children: ReactNode }) {
  const currentUser = useCurrentUser();
  const userTheme = currentUser?.theme ?? null;

  return (
    <ThemeProvider userTheme={userTheme}>
      <RootProgressBar />
      <UserThemeSync />
      {children}
      <Toaster />
    </ThemeProvider>
  );
}

export default function RootProviders({ children, initialSession }: RootProvidersProps) {
  return (
    <AppSWRProvider initialSession={initialSession}>
      <AuthBroadcastListener />
      <ThemeProviderWrapper>{children}</ThemeProviderWrapper>
    </AppSWRProvider>
  );
}
