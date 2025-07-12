'use client';

import PageLoading from '@components/Objects/Loaders/PageLoading';
import { useSession } from 'next-auth/react';
import { createContext, use } from 'react';
import type { Session } from 'next-auth';
import type { ReactNode } from 'react';

interface SessionContextType {
  data: Session | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  update: () => Promise<Session | null>;
}

export const SessionContext = createContext<SessionContextType | null>(null);

function LHSessionProvider({ children }: { children: ReactNode }) {
  const session = useSession();

  if (session.status === 'loading') {
    return <PageLoading />;
  }

  return <SessionContext value={session}>{children}</SessionContext>;
}

export function useLHSession(): SessionContextType {
  const context = use(SessionContext);
  if (!context) {
    throw new Error('useLHSession must be used within a LHSessionProvider');
  }
  return context;
}

export default LHSessionProvider;
