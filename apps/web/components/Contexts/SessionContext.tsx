'use client';

import PageLoading from '@components/Objects/Loaders/PageLoading';
import type { ClientSession } from '@/lib/auth/types';
import { createContext, use, useEffect, useMemo, useState } from 'react';
import type { Role } from '@/types/permissions';
import type { ReactNode } from 'react';

interface UserRoleWithPlatform {
  role: Role;
}

type ExtendedSessionData = ClientSession;

interface ExtendedSession {
  data: ExtendedSessionData | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  update: () => Promise<ExtendedSessionData | null>;
  isLoading?: boolean;
}

interface SessionContextType extends ExtendedSession {
  data: ExtendedSessionData | null;
}

export const SessionContext = createContext<SessionContextType | null>(null);

async function fetchSession(): Promise<ExtendedSessionData | null> {
  const response = await fetch('/api/auth/session', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const session = (await response.json()) as ClientSession | null;
  return session;
}

const PlatformSessionProvider = ({
  children,
  initialSession,
}: {
  children: ReactNode;
  initialSession?: ClientSession | null;
}) => {
  const [data, setData] = useState(initialSession ?? null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>(
    initialSession === undefined ? 'loading' : initialSession?.user ? 'authenticated' : 'unauthenticated',
  );

  const update = async () => {
    setStatus((current) => (current === 'authenticated' ? current : 'loading'));
    const nextSession = await fetchSession();
    setData(nextSession);
    setStatus(nextSession?.user ? 'authenticated' : 'unauthenticated');
    return nextSession;
  };

  useEffect(() => {
    if (initialSession !== undefined) {
      return;
    }

    void update();
  }, [initialSession]);

  const extendedSession: SessionContextType = useMemo(
    () => ({
      data,
      status,
      update,
      isLoading: status === 'loading',
    }),
    [data, status],
  );

  const isInitialLoad = status === 'loading' && data === null;

  if (isInitialLoad) {
    return <PageLoading />;
  }

  return <SessionContext value={extendedSession}>{children}</SessionContext>;
};

export function usePlatformSession(): SessionContextType {
  const context = use(SessionContext);
  if (!context) {
    throw new Error('usePlatformSession must be used within a PlatformSessionProvider');
  }
  return context;
}

export default PlatformSessionProvider;
