'use client';

import {
  buildLoginRedirect,
  emitAuthInvalidation,
  getCurrentReturnTo,
  subscribeToAuthInvalidation,
  tryRefreshToken,
} from '@/lib/auth/client';
import { useSessionStore } from '@/lib/auth/session-store';
import type { ClientSession } from '@/lib/auth/types';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

type SessionInvalidationReason =
  | 'expired'
  | 'logged_out'
  | 'revoked'
  | 'network_recovery_failed'
  | 'unauthenticated';

export interface AuthActionsContextType {
  refreshSession: () => Promise<boolean>;
  syncSession: (options?: { allowRefresh?: boolean }) => Promise<ClientSession | null>;
  invalidateSession: (
    reason: SessionInvalidationReason,
    options?: { broadcast?: boolean; redirectTo?: string | null },
  ) => void;
}

const AuthActionsContext = createContext<AuthActionsContextType | null>(null);

/** How early (ms) before token expiry to proactively refresh. */
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;

async function fetchClientSession(): Promise<ClientSession | null> {
  const response = await fetch('/api/auth/session', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return (await response.json()) as ClientSession;
}

export function SessionProvider({
  children,
  initialSession,
}: {
  children: ReactNode;
  initialSession?: ClientSession | null;
}) {
  const router = useRouter();
  const t = useTranslations('Auth.Login');

  // Reactive state reads — cause SessionProvider to re-render when session changes,
  // driving the scheduling effect. Children are passed as a prop and won't re-render.
  const data = useSessionStore((s) => s.data);
  const status = useSessionStore((s) => s.status);
  const { setSession, setLoading } = useSessionStore();

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInvalidationNonceRef = useRef<string | null>(null);

  // Stable ref to avoid a circular useCallback dep chain:
  // refreshSession → invalidateSession → syncSession → scheduleRefresh → refreshSession
  const refreshSessionRef = useRef<(() => Promise<boolean>) | null>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // scheduleRefresh only depends on clearRefreshTimer (stable).
  // refreshSession is accessed through the ref to break the dep cycle.
  const scheduleRefresh = useCallback(
    (expiresAt: number) => {
      clearRefreshTimer();
      const delay = expiresAt - Date.now() - REFRESH_BEFORE_EXPIRY_MS;
      refreshTimerRef.current = setTimeout(
        () => void refreshSessionRef.current?.(),
        Math.max(0, delay),
      );
    },
    [clearRefreshTimer],
  );

  const invalidateSession = useCallback(
    (
      reason: SessionInvalidationReason,
      options?: { broadcast?: boolean; redirectTo?: string | null },
    ) => {
      clearRefreshTimer();
      setSession(null);
      router.refresh();

      if (options?.broadcast) {
        const message = emitAuthInvalidation({
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
    [clearRefreshTimer, router, setSession, t],
  );

  const syncSession = useCallback(
    async (options?: { allowRefresh?: boolean }): Promise<ClientSession | null> => {
      if (useSessionStore.getState().status !== 'authenticated') setLoading();

      let next = await fetchClientSession();
      if (!next && options?.allowRefresh) {
        try {
          if (await tryRefreshToken()) next = await fetchClientSession();
        } catch {
          next = null;
        }
      }

      setSession(next);
      if (next?.expiresAt) scheduleRefresh(next.expiresAt);
      else clearRefreshTimer();

      return next;
    },
    [clearRefreshTimer, scheduleRefresh, setLoading, setSession],
  );

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      if (!(await tryRefreshToken())) {
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

  // Keep ref current so scheduleRefresh always calls the latest refreshSession.
  useEffect(() => {
    refreshSessionRef.current = refreshSession;
  }, [refreshSession]);

  // Initialize store from SSR data or fetch client-side on first mount.
  useEffect(() => {
    if (initialSession !== undefined) {
      setSession(initialSession ?? null);
    } else {
      void syncSession({ allowRefresh: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — SSR initialSession is stable

  // Proactive refresh scheduling whenever authenticated session data is present.
  useEffect(() => {
    if (status === 'authenticated' && data?.expiresAt) {
      scheduleRefresh(data.expiresAt);
    }
    return clearRefreshTimer;
  }, [status, data?.expiresAt, scheduleRefresh, clearRefreshTimer]);

  // Cross-tab invalidation sync.
  useEffect(() => {
    return subscribeToAuthInvalidation((detail) => {
      if (detail.nonce && detail.nonce === lastInvalidationNonceRef.current) return;
      lastInvalidationNonceRef.current = detail.nonce ?? null;

      invalidateSession(detail.reason, {
        redirectTo:
          detail.redirectTo ??
          (detail.reason === 'logged_out'
            ? null
            : buildLoginRedirect(detail.returnTo ?? getCurrentReturnTo())),
      });
    });
  }, [invalidateSession]);

  const actions = useMemo<AuthActionsContextType>(
    () => ({ refreshSession, syncSession, invalidateSession }),
    [refreshSession, syncSession, invalidateSession],
  );

  return <AuthActionsContext value={actions}>{children}</AuthActionsContext>;
}

export function useAuthActions(): AuthActionsContextType {
  const ctx = useContext(AuthActionsContext);
  if (!ctx) throw new Error('useAuthActions must be used within SessionProvider');
  return ctx;
}

/**
 * Returns session state (data, status, isLoading) from the Zustand store.
 * Always safe to call — works during SSR and outside the provider tree.
 *
 * For auth actions (syncSession, invalidateSession, refreshSession) use
 * `useAuthActions()`. For just the user object, prefer `useCurrentUser()`.
 */
export function useSession() {
  const data = useSessionStore((s) => s.data);
  const status = useSessionStore((s) => s.status);
  return { data, status, isLoading: status === 'loading' };
}
