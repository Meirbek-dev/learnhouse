'use client';

/**
 * Centralized Permission Provider
 *
 * Single source of truth for client-side permission checks.
 * Reads permissions from the NextAuth session — no separate API fetch.
 * Does simple Set.has() lookups — no wildcards, no scope broadening.
 * The backend resolves all permissions to flat explicit strings.
 */

import type { Action, Resource, Role, Scope } from '@/types/permissions';
import { createContext, useContext, useMemo } from 'react';
import { isAdminRole, perm } from '@/types/permissions';
import { useSession } from 'next-auth/react';
import type { ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

interface PermissionContextValue {
  /** Check if user has a specific permission (scope is required) */
  can: (action: Action, resource: Resource, scope: Scope) => boolean;
  /** Check if user has any of the specified permissions */
  canAny: (checks: { action: Action; resource: Resource; scope: Scope }[]) => boolean;
  /** User's roles */
  roles: Role[];
  /** Convenience: user has an admin role */
  isAdmin: boolean;
  /** Still loading session */
  loading: boolean;
}

// ============================================================================
// Context
// ============================================================================

const PermissionContext = createContext<PermissionContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  const permissions = useMemo(() => new Set<string>(session?.permissions), [session?.permissions]);

  const roles = useMemo<Role[]>(() => (session?.roles as Role[] | undefined) ?? [], [session?.roles]);

  const can = useMemo(() => {
    return (action: Action, resource: Resource, scope: Scope): boolean => {
      if (status !== 'authenticated') return false;
      return permissions.has(perm(resource, action, scope));
    };
  }, [status, permissions]);

  const canAny = useMemo(() => {
    return (checks: { action: Action; resource: Resource; scope: Scope }[]): boolean => {
      return checks.some((c) => can(c.action, c.resource, c.scope));
    };
  }, [can]);

  const isAdmin = useMemo(() => roles.some((r) => isAdminRole(r.slug)), [roles]);

  const value: PermissionContextValue = useMemo(
    () => ({
      can,
      canAny,
      roles,
      isAdmin,
      loading: status === 'loading',
    }),
    [can, canAny, roles, isAdmin, status],
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Use permissions from the centralized provider.
 *
 * @example
 * ```tsx
 * const { can, isAdmin } = usePermissions();
 *
 * if (can(Actions.CREATE, Resources.COURSE, Scopes.ORG)) {
 *   // Show create button
 * }
 * ```
 */
export function usePermissions(): PermissionContextValue {
  const context = useContext(PermissionContext);

  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }

  return context;
}
