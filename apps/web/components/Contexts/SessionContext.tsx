'use client';

import {
  buildLoginRedirect,
  broadcastAuthInvalidation,
  getCurrentReturnTo,
  subscribeToAuthInvalidation,
  tryRefreshToken,
} from '@/lib/auth/client';
import type { ClientSession } from '@/lib/auth/types';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

type SessionInvalidationReason = 'expired' | 'logged_out' | 'revoked' | 'network_recovery_failed' | 'unauthenticated';

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface SessionContextType {
  data: ClientSession | null;
  status: SessionStatus;
  isLoading: boolean;
  refreshSession: () => Promise<boolean>;
  syncSession: (options?: { allowRefresh?: boolean }) => Promise<ClientSession | null>;
  invalidateSession: (reason: SessionInvalidationReason, options?: { broadcast?: boolean; redirectTo?: string | null }) => void;
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

const PlatformSessionProvider = ({
  children,
  initialSession,
}: {
  children: ReactNode;
  initialSession?: ClientSession | null;
}) => {
  const router = useRouter();
  const t = useTranslations('Auth.Login');
  const [data, setData] = useState<ClientSession | null>(initialSession ?? null);
  const [status, setStatus] = useState<SessionStatus>(() => {
    if (initialSession === undefined) return 'loading';
    return initialSession?.user ? 'authenticated' : 'unauthenticated';
  });

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInvalidationNonceRef = useRef<string | null>(null);

  const applySession = useCallback((next: ClientSession | null) => {
    setData(next);
    setStatus(next?.user ? 'authenticated' : 'unauthenticated');
  }, []);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  function scheduleRefresh(expiresAt: number) {
    clearRefreshTimer();
    const delay = expiresAt - Date.now() - REFRESH_BEFORE_EXPIRY_MS;
    if (delay <= 0) {
      void refreshSession();
      return;
    }
    refreshTimerRef.current = setTimeout(() => void refreshSession(), delay);
  }

  const invalidateSession = useCallback(
    (reason: SessionInvalidationReason, options?: { broadcast?: boolean; redirectTo?: string | null }) => {
      clearRefreshTimer();
      applySession(null);
      router.refresh();

      if (options?.broadcast) {
        const message = broadcastAuthInvalidation({
          reason,
          redirectTo: options.redirectTo,
          returnTo: getCurrentReturnTo(),
        });
        lastInvalidationNonceRef.current = message.nonce;
      }

      if (reason === 'expired') {
        toast.error(t('sessionExpired'));
      } else if (reason === 'revoked') {
        toast.error(t('sessionRevoked'));
      } else if (reason === 'network_recovery_failed') {
        toast.error(t('sessionRecoveryFailed'));
      }

      if (options?.redirectTo) {
        globalThis.location.href = options.redirectTo;
        return;
      }

      if (reason !== 'logged_out' && reason !== 'unauthenticated') {
        globalThis.location.href = buildLoginRedirect();
      }
    },
    [applySession, clearRefreshTimer, router, t],
  );

  const syncSession = useCallback(
    async (options?: { allowRefresh?: boolean }): Promise<ClientSession | null> => {
      setStatus((current) => (current === 'authenticated' ? current : 'loading'));

      let next = await fetchSession();
      if (!next && options?.allowRefresh) {
        try {
          const refreshed = await tryRefreshToken();
          if (refreshed) {
            next = await fetchSession();
          }
        } catch {
          next = null;
        }
      }

      applySession(next);
      if (next?.expiresAt) {
        scheduleRefresh(next.expiresAt);
      } else {
        clearRefreshTimer();
      }

      return next;
    },
    [applySession, clearRefreshTimer],
  );

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const refreshed = await tryRefreshToken();
      if (!refreshed) {
        invalidateSession('expired', { broadcast: true });
        return false;
      }

      const next = await syncSession();
      if (!next) {
        invalidateSession('expired', { broadcast: true });
        return false;
      }

      return true;
    } catch {
      invalidateSession('network_recovery_failed', { broadcast: true });
      return false;
    }
  }, [invalidateSession, syncSession]);

  // Initial client-side fetch when no SSR session was provided.
  useEffect(() => {
    if (initialSession !== undefined) return;
    void syncSession({ allowRefresh: true });
  }, [initialSession, syncSession]);

  // Schedule proactive refresh whenever authenticated session data arrives.
  useEffect(() => {
    if (status === 'authenticated' && data?.expiresAt) {
      scheduleRefresh(data.expiresAt);
    }
    return () => {
      clearRefreshTimer();
    };
  }, [clearRefreshTimer, status, data?.expiresAt]);

  useEffect(() => {
    return subscribeToAuthInvalidation((detail) => {
      if (detail.nonce && detail.nonce === lastInvalidationNonceRef.current) {
        return;
      }

      lastInvalidationNonceRef.current = detail.nonce ?? null;

      invalidateSession(detail.reason, {
        redirectTo:
          detail.redirectTo ??
          (detail.reason === 'logged_out' ? null : buildLoginRedirect(detail.returnTo ?? getCurrentReturnTo())),
      });
    });
  }, [invalidateSession]);

  const contextValue = useMemo<SessionContextType>(
    () => ({
      data,
      status,
      isLoading: status === 'loading',
      refreshSession,
      syncSession,
      invalidateSession,
    }),
    [data, invalidateSession, refreshSession, status, syncSession],
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
