'use client';

import PageLoading from '@components/Objects/Loaders/PageLoading';
import type { ClientSession } from '@/lib/auth/types';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface SessionContextType {
  data: ClientSession | null;
  status: SessionStatus;
  isLoading: boolean;
  /** Re-fetch the session from the server. Attempts a token refresh if the
   *  server returns 401 before declaring the user unauthenticated. */
  update: () => Promise<ClientSession | null>;
}

export const SessionContext = createContext<SessionContextType | null>(null);

async function fetchSession(): Promise<ClientSession | null> {
  const response = await fetch('/api/auth/session', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });

  if (!response.ok) return null;

  return (await response.json()) as ClientSession | null;
}

async function fetchSessionWithRefresh(): Promise<ClientSession | null> {
  const session = await fetchSession();
  if (session) return session;

  // Session fetch failed — try to refresh the access token first
  try {
    const { refreshToken } = await import('@services/auth/auth');
    const refreshed = await refreshToken();
    if (refreshed) {
      return fetchSession();
    }
  } catch {
    // If the import or refresh call fails, fall through to unauthenticated
  }

  return null;
}

const PlatformSessionProvider = ({
  children,
  initialSession,
}: {
  children: ReactNode;
  initialSession?: ClientSession | null;
}) => {
  const [data, setData] = useState<ClientSession | null>(initialSession ?? null);
  const [status, setStatus] = useState<SessionStatus>(
    initialSession === undefined
      ? 'loading'
      : initialSession?.user
        ? 'authenticated'
        : 'unauthenticated',
  );

  const update = async (): Promise<ClientSession | null> => {
    // Keep current status visible while refreshing if already authenticated
    setStatus((current) => (current === 'authenticated' ? current : 'loading'));
    const nextSession = await fetchSessionWithRefresh();
    setData(nextSession);
    setStatus(nextSession?.user ? 'authenticated' : 'unauthenticated');
    return nextSession;
  };

  // Initial client-side fetch when no SSR session was provided
  useEffect(() => {
    if (initialSession !== undefined) return;
    void update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for the global session-expired event dispatched by the fetch interceptor
  useEffect(() => {
    const handleSessionExpired = () => {
      setData(null);
      setStatus('unauthenticated');
    };
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, []);

  const contextValue = useMemo<SessionContextType>(
    () => ({
      data,
      status,
      isLoading: status === 'loading',
      update,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, status],
  );

  // Show a full-page loader only on the initial client-side load (no SSR data)
  const isInitialLoad = status === 'loading' && data === null;
  if (isInitialLoad) {
    return <PageLoading />;
  }

  return <SessionContext value={contextValue}>{children}</SessionContext>;
};

export function usePlatformSession(): SessionContextType {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('usePlatformSession must be used within a PlatformSessionProvider');
  }
  return context;
}

export default PlatformSessionProvider;
