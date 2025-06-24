'use client';
import { useSession } from 'next-auth/react';
import { createContext, use } from 'react';
import type { ReactNode } from 'react';

import PageLoading from '@components/Objects/Loaders/PageLoading';

export const SessionContext = createContext({}) as any;

function LHSessionProvider({ children }: { children: ReactNode }) {
  const session = useSession();

  if (session && session.status === 'loading') {
    return <PageLoading />;
  }
  if (session) {
    return <SessionContext value={session}>{children}</SessionContext>;
  }

  return;
}

export function useLHSession() {
  return use(SessionContext);
}

export default LHSessionProvider;
