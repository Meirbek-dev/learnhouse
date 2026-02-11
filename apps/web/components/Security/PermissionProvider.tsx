'use client';

/**
 * Centralized Permission Provider
 *
 * Single source of truth for client-side permission checks.
 * Reads permissions from the NextAuth session - no separate API fetch.
 * Does simple Set.has() lookups - the backend expands wildcards and
 * scope-broadening before sending permissions to the frontend.
 */

import type { Action, Resource, Scope } from '@/types/permissions';
import { createContext, useContext, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { perm } from '@/types/permissions';
import type { ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

// Role assignment shape lives in the shared `types/permissions` when needed.
// Keep the context value minimal - only what consumers actually use.
interface PermissionContextValue {
  /** Check if user has a specific permission (scope is required) */
  can: (action: Action, resource: Resource, scope: Scope) => boolean;
  /** The org ID these permissions are scoped to (null = no org context) */
  orgId: number | null;
  /** Still loading session */
  loading: boolean;
}

// ============================================================================
// Context
// ============================================================================

/**
 * Permission patterns:
 *
 * 1. RBAC `can()` checks - for feature/section gating (frontend UI & route guards).
 * 2. Backend `can_*` booleans on API objects - for row-level ownership/assignment checks.
 */
const PermissionContext = createContext<PermissionContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  const permissions = useMemo(() => new Set<string>(session?.permissions), [session?.permissions]);

  const orgId = useMemo(() => {
    return (session as any)?.permissions_org_id ?? null;
  }, [session]);

  const can = useMemo(() => {
    return (action: Action, resource: Resource, scope: Scope): boolean => {
      if (status !== 'authenticated') return false;
      return permissions.has(perm(resource, action, scope));
    };
  }, [status, permissions]);

  const value: PermissionContextValue = useMemo(
    () => ({
      can,
      orgId,
      loading: status === 'loading',
    }),
    [can, orgId, status],
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
