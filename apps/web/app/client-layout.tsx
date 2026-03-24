'use client';

import PlatformSessionProvider, { usePlatformSession } from '@/components/Contexts/SessionContext';
import { PermissionProvider } from '@/components/Security/PermissionProvider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { swrFetcher } from '@services/utils/ts/requests';
import { updateUserTheme } from '@services/users/users';
import { useCallback, useEffect, useRef } from 'react';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from '@/components/ui/sonner';
import { SWRConfig, useSWRConfig } from 'swr';
import type { ReactNode } from 'react';

interface ClientLayoutProps {
  children: ReactNode;
}

/**
 * Provides a token-injecting SWR fetcher WITHOUT including the token in cache
 * keys.  URL-string keys stay stable across token rotations; when the token
 * changes we broadcast a revalidation of all SWR entries so every hook
 * transparently re-fetches with the new token.
 */
function SWRTokenProvider({ children }: { children: ReactNode }) {
  const session = usePlatformSession();
  const { mutate } = useSWRConfig();
  const tokenRef = useRef(session?.data?.tokens?.access_token);

  useEffect(() => {
    const nextToken = session?.data?.tokens?.access_token;
    if (nextToken !== tokenRef.current) {
      tokenRef.current = nextToken;
      // Revalidate all URL-string keys so hooks pick up the new token.
      void mutate((key: unknown) => typeof key === 'string', undefined, { revalidate: true });
    }
  }, [session?.data?.tokens?.access_token, mutate]);

  const fetcher = useCallback((url: string) => swrFetcher(url, tokenRef.current ?? undefined), []);

  return <SWRConfig value={{ fetcher }}>{children}</SWRConfig>;
}

function ThemeSync() {
  const session = usePlatformSession();
  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (typeof globalThis.window === 'undefined') return;

    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ theme?: string }>;
      const theme = customEvent?.detail?.theme;
      if (!theme) return;
      const s = sessionRef.current;
      if (s?.data?.user?.id && s?.data?.tokens?.access_token) {
        updateUserTheme(s.data.user.id, theme, s.data.tokens.access_token).catch((error: unknown) =>
          console.error('Failed to sync theme to server:', error),
        );
      }
    };

    globalThis.addEventListener('themeChange', handleThemeChange);
    return () => {
      globalThis.removeEventListener('themeChange', handleThemeChange);
    };
  }, []);

  return null;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <SessionProvider
      refetchInterval={5 * 60_000}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      <PlatformSessionProvider>
        <PermissionProvider>
          {/* Outer SWRConfig provides global defaults. */}
          <SWRConfig
            value={{
              dedupingInterval: 60_000,
              focusThrottleInterval: 60_000,
              revalidateOnFocus: false,
              revalidateOnReconnect: false,
              shouldRetryOnError: true,
              errorRetryCount: 3,
            }}
          >
            {/* Inner SWRTokenProvider overrides the fetcher with token injection. */}
            <SWRTokenProvider>
              <ThemeProviderWrapper>{children}</ThemeProviderWrapper>
            </SWRTokenProvider>
          </SWRConfig>
        </PermissionProvider>
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
      <main>{children}</main>
      <Toaster />
    </ThemeProvider>
  );
}
