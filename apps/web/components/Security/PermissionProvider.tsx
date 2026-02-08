'use client';

/**
 * Centralized Permission Provider
 *
 * Single source of truth for client-side permission checks.
 * Reads permissions from the NextAuth session — no separate API fetch.
 * Does simple Set.has() lookups — the backend expands wildcards and
 * scope-broadening before sending permissions to the frontend.
 */

import type { Action, Resource, Scope } from '@/types/permissions';
import { createContext, useContext, useMemo } from 'react';
import { perm } from '@/types/permissions';
import { useSession } from 'next-auth/react';
import type { ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

/** Role assignment with org context, matching the session shape. */
export interface RoleAssignment {
  role: {
    id: number;
    name: string;
    slug: string;
    description?: string;
    org_id?: number | null;
    is_system: boolean;
    priority: number;
  };
  org: {
    id: number;
    org_uuid: string;
    name: string;
    slug: string;
  };
}

interface PermissionContextValue {
  /** Check if user has a specific permission (scope is required) */
  can: (action: Action, resource: Resource, scope: Scope) => boolean;
  /** Check if user has any of the specified permissions */
  canAny: (checks: { action: Action; resource: Resource; scope: Scope }[]) => boolean;
  /** User's role assignments (role + org context) */
  roles: RoleAssignment[];
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

  const permissions = useMemo(() => new Set<string>(session?.permissions ?? []), [session?.permissions]);

  const roles = useMemo<RoleAssignment[]>(
    () => (session?.roles as RoleAssignment[] | undefined) ?? [],
    [session?.roles],
  );

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

  const value: PermissionContextValue = useMemo(
    () => ({
      can,
      canAny,
      roles,
      loading: status === 'loading',
    }),
    [can, canAny, roles, status],
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
 * const { can } = usePermissions();
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
