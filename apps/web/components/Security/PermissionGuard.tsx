'use client';

import type { Action, Resource, Scope } from '@/types/permissions';
import { usePermissions } from './PermissionProvider';
import type { ReactNode } from 'react';

interface PermissionGuardProps {
  /** Action to check permission for. */
  action: Action;
  /** Resource to check permission for. */
  resource: Resource;
  /** Permission scope (required — no silent default). */
  scope: Scope;
  /** Content to render if permission is granted. */
  children: ReactNode;
  /** Optional fallback content if permission is denied. */
  fallback?: ReactNode;
}

/**
 * Guard component that conditionally renders children based on permissions.
 *
 * @example
 * ```tsx
 * <PermissionGuard action={Actions.CREATE} resource={Resources.COURSE} scope={Scopes.ORG}>
 *   <CreateButton />
 * </PermissionGuard>
 * ```
 */
export function PermissionGuard({ action, resource, scope, children, fallback = null }: PermissionGuardProps) {
  const { can, loading } = usePermissions();

  if (loading) return null;
  if (!can(action, resource, scope)) return <>{fallback}</>;
  return <>{children}</>;
}

export default PermissionGuard;
