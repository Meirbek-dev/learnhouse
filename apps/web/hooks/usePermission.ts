'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useMemo } from 'react';
import useSWR from 'swr';

import {
  Actions,
  ResourceTypes,
  RoleSlugs,
  Scopes,
  buildPermissionName,
  isAdminRole,
  isInstructorOrHigher,
} from '@/types/permissions';
import type { Action, ResourceType, Scope } from '@/types/permissions';
import { getAPIUrl } from '@/services/config/config';
import { useOrg } from '@components/Contexts/OrgContext';

/**
 * User permissions response from backend.
 */
interface UserPermissionsResponse {
  user_id: number;
  org_id: number | null;
  roles: Array<{
    id: number;
    name: string;
    slug: string;
    description: string | null;
  }>;
  permissions: Record<string, boolean>;
  resource_permissions: any[];
}

/**
 * SWR fetcher with access token.
 */
async function permissionFetcher(url: string, accessToken?: string): Promise<UserPermissionsResponse> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch permissions: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Hook for checking user permissions.
 *
 * This hook fetches permissions from the backend API and provides methods
 * for checking if the current user has specific permissions.
 *
 * @example
 * ```tsx
 * const { can, hasRole, isAdmin } = usePermission()
 *
 * // Check specific permission
 * if (can(Actions.CREATE, ResourceTypes.COURSE)) {
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
  const { data: session, status } = useSession();
  const org = useOrg() as any;
  const orgId = org?.id;

  // Fetch permissions from backend API
  const accessToken = session?.tokens?.access_token;
  const shouldFetch = status === 'authenticated' && accessToken;

  const { data: permissionsData, error, isLoading: isLoadingPermissions } = useSWR<UserPermissionsResponse>(
    shouldFetch ? `${getAPIUrl()}permissions/me/permissions${orgId ? `?org_id=${orgId}` : ''}` : null,
    (url: string) => permissionFetcher(url, accessToken),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  /**
   * User's effective permissions map.
   */
  const permissions = useMemo(() => {
    if (permissionsData?.permissions) {
      return permissionsData.permissions;
    }
    // Fallback to session permissions (for backward compatibility)
    return {};
  }, [permissionsData?.permissions]);

  /**
   * User's role slugs.
   */
  const roles = useMemo(() => {
    if (permissionsData?.roles) {
      return permissionsData.roles.map(r => r.slug).filter(Boolean);
    }

    // Fallback to session roles (for backward compatibility)
    const userRoles = session?.roles ?? [];
    const now = new Date();

    return userRoles
      .filter((userRole: any) => {
        if (!userRole.expires_at) return true;
        const expiryDate = new Date(userRole.expires_at);
        return expiryDate > now;
      })
      .map((userRole: any) => userRole.role?.slug || userRole.role?.role_uuid || '')
      .filter(Boolean);
  }, [permissionsData?.roles, session?.roles]);

  /**
   * Check if user has a specific permission.
   *
   * @param action - Action to check
   * @param resource - Resource type
   * @param scope - Permission scope (defaults to ALL)
   * @returns True if user has the permission
   */
  const can = useCallback(
    (action: Action, resource: ResourceType, scope: Scope = Scopes.ALL): boolean => {
      // Not authenticated
      if (status !== 'authenticated' || !session) {
        // Anonymous users can only read public content
        return action === Actions.READ && scope === Scopes.ALL;
      }

      // Super admin can do anything
      if (roles.includes(RoleSlugs.SUPER_ADMIN)) {
        return true;
      }

      // Check specific permission
      const permName = buildPermissionName(resource, action, scope);
      if (permissions[permName]) {
        return true;
      }

      // Check with ALL scope if specific scope was requested
      if (scope !== Scopes.ALL) {
        const allScopePerm = buildPermissionName(resource, action, Scopes.ALL);
        if (permissions[allScopePerm]) {
          return true;
        }
      }

      // Check with ORG scope for organization-wide permissions
      if (scope === Scopes.OWN) {
        const orgScopePerm = buildPermissionName(resource, action, Scopes.ORG);
        if (permissions[orgScopePerm]) {
          return true;
        }
      }

      return false;
    },
    [status, session, roles, permissions],
  );

  /**
   * Check if user has any of the specified permissions.
   */
  const canAny = useCallback(
    (checks: { action: Action; resource: ResourceType; scope?: Scope }[]): boolean => {
      return checks.some(({ action, resource, scope }) => can(action, resource, scope));
    },
    [can],
  );

  /**
   * Check if user has all of the specified permissions.
   */
  const canAll = useCallback(
    (checks: { action: Action; resource: ResourceType; scope?: Scope }[]): boolean => {
      return checks.every(({ action, resource, scope }) => can(action, resource, scope));
    },
    [can],
  );

  /**
   * Check if user has a specific role.
   */
  const hasRole = useCallback(
    (roleSlug: string): boolean => {
      return roles.includes(roleSlug);
    },
    [roles],
  );

  /**
   * Check if user has any of the specified roles.
   */
  const hasAnyRole = useCallback(
    (roleSlugs: string[]): boolean => {
      return roleSlugs.some((slug) => roles.includes(slug));
    },
    [roles],
  );

  /**
   * Check if user is an admin (super-admin or org-admin).
   */
  const isAdmin = useMemo(() => roles.some((role) => isAdminRole(role)), [roles]);

  /**
   * Check if user is super admin.
   */
  const isSuperAdmin = useMemo(() => roles.includes(RoleSlugs.SUPER_ADMIN), [roles]);

  /**
   * Check if user is org admin.
   */
  const isOrgAdmin = useMemo(() => roles.includes(RoleSlugs.ORG_ADMIN), [roles]);

  /**
   * Check if user is instructor or higher.
   */
  const isInstructor = useMemo(() => roles.some((role) => isInstructorOrHigher(role)), [roles]);

  /**
   * Check if user is authenticated.
   */
  const isAuthenticated = status === 'authenticated';

  /**
   * Check if session or permissions are loading.
   */
  const isLoading = status === 'loading' || isLoadingPermissions;

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
  };
}

/**
 * Hook for course-specific permissions.
 *
 * @param courseUuid - Course UUID to check permissions for
 * @param isOwner - Whether the current user owns the course
 */
export function useCoursePermission(courseUuid?: string, isOwner = false) {
  const { can, isInstructor, isAdmin } = usePermission();

  const canCreate = can(Actions.CREATE, ResourceTypes.COURSE, Scopes.ORG);

  const canRead = can(Actions.READ, ResourceTypes.COURSE, Scopes.ALL);

  const canUpdate =
    isAdmin ||
    (isOwner && can(Actions.UPDATE, ResourceTypes.COURSE, Scopes.OWN)) ||
    can(Actions.UPDATE, ResourceTypes.COURSE, Scopes.ORG);

  const canDelete =
    isAdmin ||
    (isOwner && can(Actions.DELETE, ResourceTypes.COURSE, Scopes.OWN)) ||
    can(Actions.DELETE, ResourceTypes.COURSE, Scopes.ORG);

  const canManage =
    isAdmin ||
    (isOwner && can(Actions.MANAGE, ResourceTypes.COURSE, Scopes.OWN)) ||
    can(Actions.MANAGE, ResourceTypes.COURSE, Scopes.ALL);

  const canCreateContent = isAdmin || isOwner;

  const canManageContributors = isAdmin || isOwner;

  return {
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    canManage,
    canCreateContent,
    canManageContributors,
    isOwner,
  };
}

/**
 * Hook for organization-specific permissions.
 *
 * @param orgId - Organization ID to check permissions for
 */
export function useOrgPermission(orgId?: number) {
  const { can, isAdmin, isSuperAdmin, isOrgAdmin } = usePermission();

  const canRead = can(Actions.READ, ResourceTypes.ORGANIZATION, Scopes.OWN);

  const canUpdate = isSuperAdmin || isOrgAdmin || can(Actions.UPDATE, ResourceTypes.ORGANIZATION, Scopes.OWN);

  const canManage = isSuperAdmin || isOrgAdmin || can(Actions.MANAGE, ResourceTypes.ORGANIZATION, Scopes.OWN);

  const canDelete = isSuperAdmin;

  const canInvite = can(Actions.INVITE, ResourceTypes.USER, Scopes.ORG);

  const canManageRoles = can(Actions.UPDATE, ResourceTypes.ROLE, Scopes.ORG);

  return {
    canRead,
    canUpdate,
    canManage,
    canDelete,
    canInvite,
    canManageRoles,
    isAdmin,
  };
}

export default usePermission;

/**
 * Hook for checking permissions on a specific resource.
 *
 * This hook provides common permission checks for a resource type
 * with a specific resource ID, useful for resource detail pages.
 *
 * @param resourceType - Type of resource
 * @param resourceId - Resource UUID
 * @param isOwner - Whether current user owns this resource
 *
 * @example
 * ```tsx
 * const {
 *   canRead,
 *   canUpdate,
 *   canDelete,
 *   canManage,
 *   loading
 * } = useResourcePermissions(ResourceTypes.COURSE, courseUuid, isCreator)
 *
 * if (canUpdate) {
 *   // Show edit button
 * }
 * ```
 */
export function useResourcePermissions(resourceType: ResourceType, resourceId?: string, isOwner = false) {
  const { can, isAdmin, isLoading } = usePermission();

  const canRead = can(Actions.READ, resourceType, Scopes.ALL);

  const canCreate = can(Actions.CREATE, resourceType, Scopes.ORG);

  const canUpdate =
    isAdmin ||
    (isOwner && can(Actions.UPDATE, resourceType, Scopes.OWN)) ||
    can(Actions.UPDATE, resourceType, Scopes.ALL);

  const canDelete =
    isAdmin ||
    (isOwner && can(Actions.DELETE, resourceType, Scopes.OWN)) ||
    can(Actions.DELETE, resourceType, Scopes.ALL);

  const canManage =
    isAdmin ||
    (isOwner && can(Actions.MANAGE, resourceType, Scopes.OWN)) ||
    can(Actions.MANAGE, resourceType, Scopes.ALL);

  const canModerate = can(Actions.MODERATE, resourceType, Scopes.ORG);

  return {
    canRead,
    canCreate,
    canUpdate,
    canDelete,
    canManage,
    canModerate,
    isOwner,
    loading: isLoading,
  };
}
