'use client';

import type { ClientAppSession } from '@/lib/auth/session';
import PlatformSessionProvider, { usePlatformSession } from '@/components/Contexts/SessionContext';
import { PermissionProvider } from '@/components/Security/PermissionProvider';
import { ThemeProvider, useTheme } from '@/components/providers/theme-provider';
import { swrFetcher } from '@services/utils/ts/requests';
import NextTopLoader from 'nextjs-toploader';
import { Toaster } from '@/components/ui/sonner';
import { SWRConfig } from 'swr';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface RootProvidersProps {
  children: ReactNode;
  initialSession?: ClientAppSession | null;
}

function AppSWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        dedupingInterval: 60_000,
        errorRetryCount: 3,
        fetcher: (url: string) => swrFetcher(url),
        focusThrottleInterval: 60_000,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        shouldRetryOnError: true,
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
  const session = usePlatformSession() as {
    status?: 'loading' | 'authenticated' | 'unauthenticated';
    data?: {
      tokens?: { access_token?: string };
      user?: { id?: number; theme?: string | null };
    };
  };
  const { themeName } = useTheme();
  const pendingThemeRef = useRef<string | null>(null);
  const syncedThemeRef = useRef<string | null>(session?.data?.user?.theme ?? null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = session?.data?.user?.id;
  const isAuthenticated = session?.status === 'authenticated';

  useEffect(() => {
    syncedThemeRef.current = session?.data?.user?.theme ?? null;
    pendingThemeRef.current = null;
  }, [session?.data?.user?.id, session?.data?.user?.theme]);

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
    }, 1_000);

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
  const session = usePlatformSession() as { data?: { user?: { theme?: string | null } } };
  const userTheme = session?.data?.user?.theme;

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
    <PlatformSessionProvider initialSession={initialSession}>
      <PermissionProvider>
        <AppSWRProvider>
          <ThemeProviderWrapper>{children}</ThemeProviderWrapper>
        </AppSWRProvider>
      </PermissionProvider>
    </PlatformSessionProvider>
  );
}
