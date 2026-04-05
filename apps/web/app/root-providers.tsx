'use client';

import PlatformSessionProvider, { usePlatformSession } from '@/components/Contexts/SessionContext';
import { PermissionProvider } from '@/components/Security/PermissionProvider';
import { ThemeProvider, useTheme } from '@/components/providers/theme-provider';
import { swrFetcher } from '@services/utils/ts/requests';
import NextTopLoader from 'nextjs-toploader';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from '@/components/ui/sonner';
import { SWRConfig, useSWRConfig } from 'swr';
import { useEffect, useRef } from 'react';
import type { MutableRefObject, ReactNode } from 'react';

interface RootProvidersProps {
  children: ReactNode;
}

function AppSessionProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider
      refetchInterval={5 * 60_000}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      <PlatformSessionProvider>{children}</PlatformSessionProvider>
    </SessionProvider>
  );
}

function SWRTokenSync({
  children,
  token,
  tokenRef,
}: {
  children: ReactNode;
  token?: string;
  tokenRef: MutableRefObject<string | undefined>;
}) {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (token === tokenRef.current) {
      return;
    }

    tokenRef.current = token;
    void mutate((key: unknown) => typeof key === 'string', undefined, { revalidate: true });
  }, [mutate, token, tokenRef]);

  return children;
}

function AppSWRProvider({ children }: { children: ReactNode }) {
  const session = usePlatformSession();
  const tokenRef = useRef(session?.data?.tokens?.access_token);

  return (
    <SWRConfig
      value={{
        dedupingInterval: 60_000,
        errorRetryCount: 3,
        fetcher: (url: string) => swrFetcher(url, tokenRef.current ?? undefined),
        focusThrottleInterval: 60_000,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        shouldRetryOnError: true,
      }}
    >
      <SWRTokenSync
        token={session?.data?.tokens?.access_token}
        tokenRef={tokenRef}
      >
        {children}
      </SWRTokenSync>
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
  const accessToken = session?.data?.tokens?.access_token;

  useEffect(() => {
    syncedThemeRef.current = session?.data?.user?.theme ?? null;
    pendingThemeRef.current = null;
  }, [session?.data?.user?.id, session?.data?.user?.theme]);

  useEffect(() => {
    if (!userId || !accessToken) {
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
  }, [accessToken, themeName, userId]);

  useEffect(() => {
    if (!userId || !accessToken) {
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
  }, [accessToken, userId]);

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

export default function RootProviders({ children }: RootProvidersProps) {
  return (
    <AppSessionProvider>
      <PermissionProvider>
        <AppSWRProvider>
          <ThemeProviderWrapper>{children}</ThemeProviderWrapper>
        </AppSWRProvider>
      </PermissionProvider>
    </AppSessionProvider>
  );
}
