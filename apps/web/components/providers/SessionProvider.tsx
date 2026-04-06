'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { ClientSession } from '@/lib/auth/types';
import { getAPIUrl } from '@services/config/config';

interface SessionContextValue {
  session: ClientSession | null;
  isLoading: boolean;
}

const SessionContext = createContext<SessionContextValue>({ session: null, isLoading: true });

export function useSession() {
  return useContext(SessionContext);
}

interface SessionProviderProps {
  children: ReactNode;
  initialSession: ClientSession | null;
}

const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export function SessionProvider({ children, initialSession }: SessionProviderProps) {
  const [session, setSession] = useState(initialSession);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleRefresh(expiresAt: number) {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

    const delay = expiresAt - Date.now() - REFRESH_BEFORE_EXPIRY_MS;
    if (delay <= 0) {
      void doRefresh();
      return;
    }

    refreshTimerRef.current = setTimeout(() => void doRefresh(), delay);
  }

  async function doRefresh() {
    try {
      const res = await fetch(`${getAPIUrl()}auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });

      if (!res.ok) {
        setSession(null);
        router.push('/login');
        return;
      }

      // Re-fetch session to get updated expiry from server.
      const sessionRes = await fetch(`${getAPIUrl()}users/session`, {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!sessionRes.ok) {
        setSession(null);
        router.push('/login');
        return;
      }

      const data = await sessionRes.json();
      const updated: ClientSession = { ...data, expiresAt: Date.now() + 8 * 60 * 60 * 1000 };
      setSession(updated);
      scheduleRefresh(updated.expiresAt);
    } catch {
      setSession(null);
      router.push('/login');
    }
  }

  useEffect(() => {
    if (session?.expiresAt) {
      scheduleRefresh(session.expiresAt);
    }

    const onExpired = () => {
      setSession(null);
      router.push('/login');
    };

    globalThis.addEventListener('auth:session-expired', onExpired);
    return () => {
      globalThis.removeEventListener('auth:session-expired', onExpired);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.expiresAt]);

  return <SessionContext.Provider value={{ session, isLoading }}>{children}</SessionContext.Provider>;
}
