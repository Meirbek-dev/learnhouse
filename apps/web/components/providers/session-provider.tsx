'use client';

import { createContext, use, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Action, Resource, Scope } from '@/types/permissions';
import { perm } from '@/types/permissions';
import type { Session } from '@/lib/auth/types';

// ── Context value ─────────────────────────────────────────────────────────────

export interface SessionContextValue {
  isAuthenticated: boolean;
  session: Session | null;
  user: Session['user'] | null;
  /**
   * Check whether the current user holds a specific RBAC permission.
   *
   * Delegates to the permission set embedded in the session (expanded by the
   * backend before being placed in the JWT).  Uses an exact Set.has() lookup —
   * no wildcard matching required on the frontend.
   *
   * Returns false when the user is not authenticated.
   */
  can: (resource: Resource, action: Action, scope: Scope) => boolean;
  /**
   * Re-fetch the session by triggering a full RSC refresh via router.refresh().
   *
   * Use this after operations that change authentication state on the client
   * (e.g. post-OAuth redirect, receiving a roles-updated WebSocket event)
   * without requiring a full page navigation.
   */
  refresh: () => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

interface SessionProviderProps {
  children: ReactNode;
  initialSession?: Session | null;
}

export function SessionProvider({ children, initialSession = null }: SessionProviderProps) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(initialSession);

  // Trigger a full RSC refresh; Next.js re-runs getSession() server-side and
  // streams fresh data to the client without a navigation.
  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  // Lazily build a permission Set so lookup is O(1).  Recomputed only when
  // session.permissions reference changes.
  const permissionsSet = useMemo(
    () => new Set<string>(session?.permissions ?? []),
    [session?.permissions],
  );

  const can = useCallback(
    (resource: Resource, action: Action, scope: Scope): boolean => {
      if (!session) return false;
      return permissionsSet.has(perm(resource, action, scope));
    },
    [session, permissionsSet],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      isAuthenticated: session?.user !== undefined,
      session,
      user: session?.user ?? null,
      can,
      refresh,
    }),
    [session, can, refresh],
  );

  // Expose setSession so layout can hydrate from server — currently unused
  // since initialSession is passed at construction, but kept for future use.
  void setSession;

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSessionContext(): SessionContextValue {
  const context = use(SessionContext);

  if (context === undefined) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }

  return context;
}
