'use client';

/**
 * Centralized Permission Provider
 *
 * Delegates to SessionContext — ``can()`` is now a first-class member of
 * SessionContextValue so permissions live in a single context, eliminating
 * the need for a separate provider or context lookup.
 *
 * This component is kept for backward-compatibility: existing code that
 * renders ``<PermissionProvider>`` continues to work unchanged, and
 * ``usePermissions()`` still provides the same ``can`` / ``loading`` API.
 */

import type { Action, Resource, Scope } from '@/types/permissions';
import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PermissionContextValue {
  /** Check if user has a specific permission: can(resource, action, scope) */
  can: (action: Action, resource: Resource, scope: Scope) => boolean;
  /** Always false — kept for API compatibility. */
  loading: false;
}

// ── Context ───────────────────────────────────────────────────────────────────

const PermissionContext = createContext<PermissionContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

/**
 * PermissionProvider is now a thin delegation layer over SessionContext.
 * It no longer manages its own permissions state — all permission data is
 * sourced from the access-token claims embedded in SessionProvider.
 *
 * Note: the argument order of the ``can`` callback intentionally matches the
 * legacy API (action, resource, scope) to avoid breaking existing callers,
 * while SessionProvider exposes ``can(resource, action, scope)`` per the plan.
 */
export function PermissionProvider({ children }: { children: ReactNode }) {
  const { can: sessionCan } = useAuth();

  // Adapt the argument order: legacy API is (action, resource, scope),
  // SessionContext.can is (resource, action, scope).
  const can = useMemo(
    () =>
      (action: Action, resource: Resource, scope: Scope): boolean =>
        sessionCan(resource, action, scope),
    [sessionCan],
  );

  const value = useMemo<PermissionContextValue>(
    () => ({ can, loading: false }),
    [can],
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * @example
 * ```tsx
 * const { can } = usePermissions();
 * if (can(Actions.CREATE, Resources.COURSE, Scopes.PLATFORM)) {
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
