'use client';

import LHSessionProvider, { useLHSession } from '@components/Contexts/LHSessionContext';
import StyledComponentsRegistry from '../components/Utils/libs/styled-registry';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { updateUserTheme } from '@services/users/users';
import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

interface ClientLayoutProps {
  children: ReactNode;
}

function ThemeSync() {
  const session = useLHSession() as any;

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

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <SessionProvider
      refetchInterval={60_000}
      refetchOnWindowFocus
      refetchWhenOffline={false}
    >
      <LHSessionProvider>
        <ThemeProviderWrapper>{children}</ThemeProviderWrapper>
      </LHSessionProvider>
    </SessionProvider>
  );
}

function ThemeProviderWrapper({ children }: { children: ReactNode }) {
  const session = useLHSession() as any;
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
