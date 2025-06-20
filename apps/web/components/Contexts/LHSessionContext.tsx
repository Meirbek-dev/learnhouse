'use client';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { useSession } from 'next-auth/react';
import { use, createContext } from 'react';
import type { ReactNode } from 'react';

export const SessionContext = createContext({}) as any;

function LHSessionProvider({ children }: { children: ReactNode }) {
  const session = useSession();

  if (session && session.status == 'loading') {
    return <PageLoading />;
  }
  if (session) {
    return <SessionContext value={session}>{children}</SessionContext>;
  }
}

export function useLHSession() {
  return use(SessionContext);
}

export default LHSessionProvider;
