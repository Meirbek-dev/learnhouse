'use client';

import NextTopLoader from 'nextjs-toploader';
import { Toaster } from '@/components/ui/sonner';
import { SessionProvider } from '@/components/providers/session-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { ReactQueryProvider } from '@/lib/react-query/providers';
import type { Session } from '@/lib/auth/types';
import type { ReactNode } from 'react';

interface RootProvidersProps {
  children: ReactNode;
  initialSession?: Session | null;
}

export default function RootProviders({ children, initialSession }: RootProvidersProps) {
  return (
    <ReactQueryProvider>
      <SessionProvider initialSession={initialSession}>
        <ThemeProvider>
          <NextTopLoader showSpinner={false} />
          {children}
          <Toaster />
        </ThemeProvider>
      </SessionProvider>
    </ReactQueryProvider>
  );
}
