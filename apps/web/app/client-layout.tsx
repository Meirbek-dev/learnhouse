'use client';

import LHSessionProvider, { useLHSession } from '@components/Contexts/LHSessionContext';
import StyledComponentsRegistry from '../components/Utils/libs/styled-registry';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { updateUserTheme } from '@services/users/users';
import { SessionProvider } from 'next-auth/react';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

interface ClientLayoutProps {
  children: ReactNode;
}

const variants = {
  hidden: { opacity: 0 },
  enter: { opacity: 1 },
  exit: { opacity: 0 },
} as const;

const pageTransition = {
  type: 'tween' as const,
  ease: 'linear' as const,
  duration: 0.3,
} as const;

function ThemeSync() {
  const session = useLHSession() as any;

  useEffect(() => {
    const handleThemeChange = async (event: Event) => {
      const customEvent = event as CustomEvent<{ theme: string }>;
      if (session?.data?.user?.id && session?.data?.tokens?.access_token) {
        try {
          await updateUserTheme(session.data.user.id, customEvent.detail.theme, session.data.tokens.access_token);
          // Refresh session to get updated theme from server
          await session.update();
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
        <motion.main
          variants={variants}
          initial="hidden"
          animate="enter"
          exit="exit"
          transition={pageTransition}
        >
          {children}
        </motion.main>
      </StyledComponentsRegistry>
    </ThemeProvider>
  );
}
