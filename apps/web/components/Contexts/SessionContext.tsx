'use client';

import type { ClientSession } from '@/lib/auth/types';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface SessionContextType {
  data: ClientSession | null;
  status: SessionStatus;
  isLoading: boolean;
  /** Re-fetch the session from the server. Handles token refresh automatically. */
  update: () => Promise<ClientSession | null>;
}

export const SessionContext = createContext<SessionContextType | null>(null);

/** How early (ms) before access token expiry to proactively refresh. */
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;

async function fetchSession(): Promise<ClientSession | null> {
  const response = await fetch('/api/auth/session', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });

  if (!response.ok) return null;

  return (await response.json()) as ClientSession;
}

async function fetchSessionWithRefresh(): Promise<ClientSession | null> {
  const session = await fetchSession();
  if (session) return session;

  try {
    const { refreshToken } = await import('@services/auth/auth');
    const refreshed = await refreshToken();
    if (refreshed) return fetchSession();
  } catch {
    // If the import or refresh call fails, fall through to unauthenticated.
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
  const [status, setStatus] = useState<SessionStatus>(() => {
    if (initialSession === undefined) return 'loading';
    return initialSession?.user ? 'authenticated' : 'unauthenticated';
  });

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleRefresh(expiresAt: number) {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const delay = expiresAt - Date.now() - REFRESH_BEFORE_EXPIRY_MS;
    if (delay <= 0) {
      void performRefresh();
      return;
    }
    refreshTimerRef.current = setTimeout(() => void performRefresh(), delay);
  }

  async function performRefresh() {
    try {
      const { refreshToken } = await import('@services/auth/auth');
      const refreshed = await refreshToken();
      if (!refreshed) {
        setData(null);
        setStatus('unauthenticated');
        return;
      }
      // Re-fetch so expiresAt reflects the new token's actual expiry.
      const next = await fetchSession();
      if (next) {
        setData(next);
        setStatus('authenticated');
        if (next.expiresAt) scheduleRefresh(next.expiresAt);
      } else {
        setData(null);
        setStatus('unauthenticated');
      }
    } catch {
      setData(null);
      setStatus('unauthenticated');
    }
  }

  const update = useCallback(async (): Promise<ClientSession | null> => {
    setStatus((current) => (current === 'authenticated' ? current : 'loading'));
    const next = await fetchSessionWithRefresh();
    setData(next);
    setStatus(next?.user ? 'authenticated' : 'unauthenticated');
    if (next?.expiresAt) scheduleRefresh(next.expiresAt);
    return next;
    // scheduleRefresh is stable (defined outside useCallback, uses refs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial client-side fetch when no SSR session was provided.
  useEffect(() => {
    if (initialSession !== undefined) return;
    void update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Schedule proactive refresh whenever authenticated session data arrives.
  useEffect(() => {
    if (status === 'authenticated' && data?.expiresAt) {
      scheduleRefresh(data.expiresAt);
    }
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, data?.expiresAt]);

  // Listen for the global session-expired event dispatched by the API client.
  useEffect(() => {
    const handleSessionExpired = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
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
    [data, status, update],
  );

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
