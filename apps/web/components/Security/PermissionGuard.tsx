'use client'

import type { ReactNode } from 'react'

import { usePermission } from '@/hooks/usePermission'
import type { Action, ResourceType, Scope } from '@/types/permissions'

interface PermissionGuardProps {
  /**
   * Action to check permission for.
   */
  action: Action
  /**
   * Resource type to check permission for.
   */
  resource: ResourceType
  /**
   * Optional resource ID for resource-specific checks.
   */
  resourceId?: string
  /**
   * Permission scope (defaults to ALL).
   */
  scope?: Scope
  /**
   * Content to render if permission is granted.
   */
  children: ReactNode
  /**
   * Optional fallback content if permission is denied.
   * If not provided, nothing is rendered.
   */
  fallback?: ReactNode
  /**
   * If true, shows loading state while checking permissions.
   */
  showLoading?: boolean
  /**
   * Custom loading component.
   */
  loadingComponent?: ReactNode
}

/**
 * Guard component that conditionally renders children based on permissions.
 *
 * This component checks if the current user has the required permission
 * and only renders children if the check passes.
 *
 * @example
 * ```tsx
 * // Hide delete button if user can't delete
 * <PermissionGuard action={Action.DELETE} resource={ResourceType.COURSE} resourceId={courseId}>
 *   <DeleteButton />
 * </PermissionGuard>
 *
 * // Show fallback for unauthorized users
 * <PermissionGuard
 *   action={Action.UPDATE}
 *   resource={ResourceType.COURSE}
 *   fallback={<span>Read-only mode</span>}
 * >
 *   <EditForm />
 * </PermissionGuard>
 * ```
 */
export function PermissionGuard({
  action,
  resource,
  resourceId,
  scope,
  children,
  fallback = null,
  showLoading = false,
  loadingComponent = null,
}: PermissionGuardProps) {
  const { can, isLoading } = usePermission()

  // Show loading state if requested
  if (isLoading && showLoading) {
    return <>{loadingComponent}</>
  }

  // Check permission
  const hasPermission = can(action, resource, scope)

  if (!hasPermission) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

interface MultiPermissionGuardProps {
  /**
   * Array of permission checks. All must pass for children to render.
   */
  permissions: Array<{
    action: Action
    resource: ResourceType
    scope?: Scope
  }>
  /**
   * If true, only one permission needs to pass (OR logic).
   * If false (default), all permissions must pass (AND logic).
   */
  any?: boolean
  /**
   * Content to render if permissions are granted.
   */
  children: ReactNode
  /**
   * Optional fallback content if permissions are denied.
   */
  fallback?: ReactNode
}

/**
 * Guard component that checks multiple permissions.
 *
 * @example
 * ```tsx
 * // Require both create and manage permissions
 * <MultiPermissionGuard
 *   permissions={[
 *     { action: Action.CREATE, resource: ResourceType.COURSE },
 *     { action: Action.MANAGE, resource: ResourceType.ORGANIZATION },
 *   ]}
 * >
 *   <AdminPanel />
 * </MultiPermissionGuard>
 *
 * // Require any of the permissions (OR logic)
 * <MultiPermissionGuard
 *   any
 *   permissions={[
 *     { action: Action.UPDATE, resource: ResourceType.COURSE },
 *     { action: Action.DELETE, resource: ResourceType.COURSE },
 *   ]}
 *   fallback={<span>No edit access</span>}
 * >
 *   <EditControls />
 * </MultiPermissionGuard>
 * ```
 */
export function MultiPermissionGuard({
  permissions,
  any = false,
  children,
  fallback = null,
}: MultiPermissionGuardProps) {
  const { canAny, canAll } = usePermission()

  const hasPermission = any ? canAny(permissions) : canAll(permissions)

  if (!hasPermission) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

interface RoleGuardProps {
  /**
   * Role slug or array of role slugs to check.
   */
  role: string | string[]
  /**
   * If true with array of roles, any role is sufficient.
   * If false, user must have all specified roles.
   */
  any?: boolean
  /**
   * Content to render if role check passes.
   */
  children: ReactNode
  /**
   * Optional fallback content.
   */
  fallback?: ReactNode
}

/**
 * Guard component that checks user roles.
 *
 * @example
 * ```tsx
 * // Require admin role
 * <RoleGuard role="org-admin">
 *   <AdminSettings />
 * </RoleGuard>
 *
 * // Require any of the instructor-level roles
 * <RoleGuard role={['instructor', 'maintainer', 'org-admin']} any>
 *   <InstructorDashboard />
 * </RoleGuard>
 * ```
 */
export function RoleGuard({ role, any = true, children, fallback = null }: RoleGuardProps) {
  const { hasRole, hasAnyRole, roles } = usePermission()

  let hasRequiredRole: boolean

  if (Array.isArray(role)) {
    hasRequiredRole = any
      ? hasAnyRole(role)
      : role.every((r) => roles.includes(r))
  } else {
    hasRequiredRole = hasRole(role)
  }

  if (!hasRequiredRole) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

interface AuthGuardProps {
  /**
   * Content to render if user is authenticated.
   */
  children: ReactNode
  /**
   * Optional fallback content for unauthenticated users.
   */
  fallback?: ReactNode
  /**
   * If true, shows loading state during authentication check.
   */
  showLoading?: boolean
  /**
   * Custom loading component.
   */
  loadingComponent?: ReactNode
}

/**
 * Guard component that requires authentication.
 *
 * @example
 * ```tsx
 * <AuthGuard fallback={<LoginPrompt />}>
 *   <UserProfile />
 * </AuthGuard>
 * ```
 */
export function AuthGuard({
  children,
  fallback = null,
  showLoading = true,
  loadingComponent = null,
}: AuthGuardProps) {
  const { isAuthenticated, isLoading } = usePermission()

  if (isLoading && showLoading) {
    return <>{loadingComponent}</>
  }

  if (!isAuthenticated) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

interface AdminGuardProps {
  /**
   * Content to render if user is admin.
   */
  children: ReactNode
  /**
   * Optional fallback content.
   */
  fallback?: ReactNode
  /**
   * If true, requires super-admin specifically.
   * If false (default), org-admin is sufficient.
   */
  superAdminOnly?: boolean
}

/**
 * Guard component that requires admin role.
 *
 * @example
 * ```tsx
 * <AdminGuard fallback={<AccessDenied />}>
 *   <AdminDashboard />
 * </AdminGuard>
 *
 * // Require super-admin specifically
 * <AdminGuard superAdminOnly>
 *   <PlatformSettings />
 * </AdminGuard>
 * ```
 */
export function AdminGuard({
  children,
  fallback = null,
  superAdminOnly = false,
}: AdminGuardProps) {
  const { isAdmin, isSuperAdmin } = usePermission()

  const hasAccess = superAdminOnly ? isSuperAdmin : isAdmin

  if (!hasAccess) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

export default PermissionGuard
