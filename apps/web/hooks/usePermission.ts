'use client'

import { useSession } from 'next-auth/react'
import { useCallback, useMemo } from 'react'

import {
  Action,
  buildPermissionName,
  isAdminRole,
  isInstructorOrHigher,
  ResourceType,
  RoleSlugs,
  Scope,
} from '@/types/permissions'

/**
 * Hook for checking user permissions.
 *
 * This hook provides methods for checking if the current user has
 * specific permissions based on their roles and effective permissions.
 *
 * @example
 * ```tsx
 * const { can, hasRole, isAdmin } = usePermission()
 *
 * // Check specific permission
 * if (can(Action.CREATE, ResourceType.COURSE)) {
 *   // Show create button
 * }
 *
 * // Check role
 * if (hasRole('instructor')) {
 *   // Show instructor features
 * }
 * ```
 */
export function usePermission() {
  const { data: session, status } = useSession()

  /**
   * User's effective permissions map.
   */
  const permissions = useMemo(
    () => session?.permissions ?? {},
    [session?.permissions]
  )

  /**
   * User's role slugs.
   */
  const roles = useMemo(() => session?.roles ?? [], [session?.roles])

  /**
   * Check if user has a specific permission.
   *
   * @param action - Action to check
   * @param resource - Resource type
   * @param scope - Permission scope (defaults to ALL)
   * @returns True if user has the permission
   */
  const can = useCallback(
    (
      action: Action,
      resource: ResourceType,
      scope: Scope = Scope.ALL
    ): boolean => {
      // Not authenticated
      if (status !== 'authenticated' || !session) {
        // Anonymous users can only read public content
        return action === Action.READ && scope === Scope.ALL
      }

      // Super admin can do anything
      if (roles.includes(RoleSlugs.SUPER_ADMIN)) {
        return true
      }

      // Check specific permission
      const permName = buildPermissionName(resource, action, scope)
      if (permissions[permName]) {
        return true
      }

      // Check with ALL scope if specific scope was requested
      if (scope !== Scope.ALL) {
        const allScopePerm = buildPermissionName(resource, action, Scope.ALL)
        if (permissions[allScopePerm]) {
          return true
        }
      }

      // Check with ORG scope for organization-wide permissions
      if (scope === Scope.OWN) {
        const orgScopePerm = buildPermissionName(resource, action, Scope.ORG)
        if (permissions[orgScopePerm]) {
          return true
        }
      }

      return false
    },
    [status, session, roles, permissions]
  )

  /**
   * Check if user has any of the specified permissions.
   */
  const canAny = useCallback(
    (checks: Array<{ action: Action; resource: ResourceType; scope?: Scope }>): boolean => {
      return checks.some(({ action, resource, scope }) => can(action, resource, scope))
    },
    [can]
  )

  /**
   * Check if user has all of the specified permissions.
   */
  const canAll = useCallback(
    (checks: Array<{ action: Action; resource: ResourceType; scope?: Scope }>): boolean => {
      return checks.every(({ action, resource, scope }) => can(action, resource, scope))
    },
    [can]
  )

  /**
   * Check if user has a specific role.
   */
  const hasRole = useCallback(
    (roleSlug: string): boolean => {
      return roles.includes(roleSlug)
    },
    [roles]
  )

  /**
   * Check if user has any of the specified roles.
   */
  const hasAnyRole = useCallback(
    (roleSlugs: string[]): boolean => {
      return roleSlugs.some((slug) => roles.includes(slug))
    },
    [roles]
  )

  /**
   * Check if user is an admin (super-admin or org-admin).
   */
  const isAdmin = useMemo(
    () => roles.some((role) => isAdminRole(role)),
    [roles]
  )

  /**
   * Check if user is super admin.
   */
  const isSuperAdmin = useMemo(
    () => roles.includes(RoleSlugs.SUPER_ADMIN),
    [roles]
  )

  /**
   * Check if user is org admin.
   */
  const isOrgAdmin = useMemo(
    () => roles.includes(RoleSlugs.ORG_ADMIN),
    [roles]
  )

  /**
   * Check if user is instructor or higher.
   */
  const isInstructor = useMemo(
    () => roles.some((role) => isInstructorOrHigher(role)),
    [roles]
  )

  /**
   * Check if user is authenticated.
   */
  const isAuthenticated = status === 'authenticated'

  /**
   * Check if session is loading.
   */
  const isLoading = status === 'loading'

  return {
    // Permission checks
    can,
    canAny,
    canAll,
    permissions,

    // Role checks
    hasRole,
    hasAnyRole,
    roles,

    // Quick role checks
    isAdmin,
    isSuperAdmin,
    isOrgAdmin,
    isInstructor,

    // Auth state
    isAuthenticated,
    isLoading,
    session,
  }
}

/**
 * Hook for course-specific permissions.
 *
 * @param courseUuid - Course UUID to check permissions for
 * @param isOwner - Whether the current user owns the course
 */
export function useCoursePermission(courseUuid?: string, isOwner = false) {
  const { can, isInstructor, isAdmin } = usePermission()

  const canCreate = can(Action.CREATE, ResourceType.COURSE, Scope.ORG)

  const canRead = can(Action.READ, ResourceType.COURSE, Scope.ALL)

  const canUpdate =
    isAdmin ||
    (isOwner && can(Action.UPDATE, ResourceType.COURSE, Scope.OWN)) ||
    can(Action.UPDATE, ResourceType.COURSE, Scope.ORG)

  const canDelete =
    isAdmin ||
    (isOwner && can(Action.DELETE, ResourceType.COURSE, Scope.OWN)) ||
    can(Action.DELETE, ResourceType.COURSE, Scope.ORG)

  const canManage =
    isAdmin ||
    (isOwner && can(Action.MANAGE, ResourceType.COURSE, Scope.OWN)) ||
    can(Action.MANAGE, ResourceType.COURSE, Scope.ALL)

  const canCreateContent = isAdmin || isOwner

  const canManageContributors = isAdmin || isOwner

  return {
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    canManage,
    canCreateContent,
    canManageContributors,
    isOwner,
  }
}

/**
 * Hook for organization-specific permissions.
 *
 * @param orgId - Organization ID to check permissions for
 */
export function useOrgPermission(orgId?: number) {
  const { can, isAdmin, isSuperAdmin, isOrgAdmin } = usePermission()

  const canRead = can(Action.READ, ResourceType.ORGANIZATION, Scope.OWN)

  const canUpdate =
    isSuperAdmin ||
    isOrgAdmin ||
    can(Action.UPDATE, ResourceType.ORGANIZATION, Scope.OWN)

  const canManage =
    isSuperAdmin ||
    isOrgAdmin ||
    can(Action.MANAGE, ResourceType.ORGANIZATION, Scope.OWN)

  const canDelete = isSuperAdmin

  const canInvite = can(Action.INVITE, ResourceType.USER, Scope.ORG)

  const canManageRoles = can(Action.UPDATE, ResourceType.ROLE, Scope.ORG)

  return {
    canRead,
    canUpdate,
    canManage,
    canDelete,
    canInvite,
    canManageRoles,
    isAdmin,
  }
}

export default usePermission
