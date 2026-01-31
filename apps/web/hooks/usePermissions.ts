'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useMemo } from 'react';
import useSWR from 'swr';

import type { Action, ResourceType, Scope } from '@/types/permissions';
import {
  Actions,
  ResourceTypes,
  Scopes,
  buildPermissionName,
  isAdminRole,
  isInstructorOrHigher,
} from '@/types/permissions';
import { useOrg } from '@components/Contexts/OrgContext';
import { getAPIUrl } from '@/services/config/config';

/**
 * Resource with permission metadata from enriched API responses.
 */
export interface ResourceWithPermissions {
  can_update?: boolean;
  can_delete?: boolean;
  can_create?: boolean;
  can_read?: boolean;
  can_manage?: boolean;
  can_moderate?: boolean;
  can_publish?: boolean;
  can_grade?: boolean;
  is_owner?: boolean;
  is_creator?: boolean;
  is_contributor?: boolean;
  available_actions?: string[];
}

/**
 * User permissions response from backend.
 */
interface UserPermissionsResponse {
  user_id: number;
  org_id: number | null;
  roles: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
  }[];
  permissions: Record<string, boolean>;
  resource_permissions?: any[];
}

/**
 * Resource-specific permission response from backend.
 */
interface ResourcePermissionResponse {
  resource_id: string;
  resource_type: ResourceType;
  permissions: Record<string, boolean>;
  user_is_owner: boolean;
  available_actions: Action[];
}

/**
 * SWR fetcher with access token.
 */
async function permissionFetcher(url: string, accessToken?: string): Promise<UserPermissionsResponse | ResourcePermissionResponse> {
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
 * Options for usePermissions hook.
 */
export interface UsePermissionsOptions {
  /**
   * Resource type for resource-specific permission checks.
   */
  resourceType?: ResourceType;

  /**
   * Resource ID (UUID) for resource-specific permission checks.
   */
  resourceId?: string;

  /**
   * Organization ID for scoped permission checks.
   */
  orgId?: number;

  /**
   * Pre-fetched resource with embedded permission metadata.
   * When provided, the hook will extract permissions from this object
   * instead of fetching from the API.
   */
  resource?: ResourceWithPermissions | null | undefined;
}

/**
 * Unified permission hook combining global, resource-specific, and metadata-based permissions.
 *
 * This hook consolidates three previous hooks into one unified interface:
 * - `usePermission` - Global permissions
 * - `useResourcePermission` - Resource-specific API fetch
 * - `useResourcePermissions` - Metadata extraction from enriched responses
 *
 * @param options - Configuration options for the hook
 *
 * @example
 * ```tsx
 * // Global permission check
 * const { can, hasRole, isAdmin } = usePermissions();
 * if (can(Actions.CREATE, ResourceTypes.COURSE)) {
 *   // Show create button
 * }
 *
 * // Resource-specific permission check (fetches from API)
 * const { canUpdate, canDelete, isOwner } = usePermissions({
 *   resourceType: ResourceTypes.COURSE,
 *   resourceId: courseUuid,
 * });
 *
 * // From enriched API response (no extra fetch)
 * const course = { ...courseData, can_update: true, is_owner: false };
 * const { canUpdate, isOwner } = usePermissions({ resource: course });
 * ```
 */
export function usePermissions(options?: UsePermissionsOptions) {
  const { data: session, status } = useSession();
  const org = useOrg() as any;
  const contextOrgId = org?.id;

  // Determine effective org_id (explicit > context)
  const effectiveOrgId = options?.orgId ?? contextOrgId;

  // Determine API endpoint based on options
  const endpoint = useMemo(() => {
    if (options?.resource) {
      // Using embedded metadata, no fetch needed
      return null;
    }

    if (options?.resourceType && options?.resourceId) {
      // Resource-specific permissions
      const orgParam = effectiveOrgId ? `?org_id=${effectiveOrgId}` : '';
      return `${getAPIUrl()}permissions/resource/${options.resourceType}/${options.resourceId}${orgParam}`;
    }

    // Global permissions
    const orgParam = effectiveOrgId ? `?org_id=${effectiveOrgId}` : '';
    return `${getAPIUrl()}me/permissions${orgParam}`;
  }, [options?.resource, options?.resourceType, options?.resourceId, effectiveOrgId]);

  // Fetch permissions from API
  const accessToken = session?.tokens?.access_token;
  const shouldFetch = status === 'authenticated' && accessToken && endpoint !== null;

  const {
    data: apiData,
    error,
    isLoading: isLoadingApi,
  } = useSWR(
    shouldFetch ? endpoint : null,
    (url: string) => permissionFetcher(url, accessToken),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60_000, // Cache for 1 minute
    },
  );

  // Extract permissions from either API response or embedded metadata
  const permissions = useMemo(() => {
    // Priority 1: Embedded metadata from resource
    if (options?.resource) {
      return {
        can_update: options.resource.can_update ?? false,
        can_delete: options.resource.can_delete ?? false,
        can_create: options.resource.can_create ?? false,
        can_read: options.resource.can_read ?? false,
        can_manage: options.resource.can_manage ?? false,
        can_moderate: options.resource.can_moderate ?? false,
        can_publish: options.resource.can_publish ?? false,
        can_grade: options.resource.can_grade ?? false,
        is_owner: options.resource.is_owner ?? false,
        is_creator: options.resource.is_creator ?? false,
        is_contributor: options.resource.is_contributor ?? false,
        available_actions: options.resource.available_actions ?? [],
      };
    }

    // Priority 2: API response (resource-specific)
    if (apiData && 'resource_id' in apiData) {
      const resourceData = apiData as ResourcePermissionResponse;
      return {
        ...resourceData.permissions,
        is_owner: resourceData.user_is_owner,
        available_actions: resourceData.available_actions,
      };
    }

    // Priority 3: API response (global permissions)
    if (apiData && 'permissions' in apiData) {
      const userData = apiData as UserPermissionsResponse;
      return userData.permissions;
    }

    return {};
  }, [apiData, options?.resource]);

  // Extract roles from API response
  const roles = useMemo(() => {
    if (apiData && 'roles' in apiData) {
      const userData = apiData as UserPermissionsResponse;
      return userData.roles ?? [];
    }
    return [];
  }, [apiData]);

  /**
   * Check if user has a specific permission.
   *
   * @param action - The action to check (e.g., Actions.CREATE)
   * @param resource - The resource type (e.g., ResourceTypes.COURSE)
   * @param scope - The permission scope (defaults to Scopes.ALL)
   * @returns true if user has the permission
   */
  const can = useCallback(
    (action: Action, resource: ResourceType, scope: Scope = Scopes.ALL): boolean => {
      if (!session) return false;

      const permissionName = buildPermissionName(resource, action, scope);
      return permissions[permissionName] === true;
    },
    [session, permissions],
  );

  /**
   * Check if user has ANY of the specified permissions.
   *
   * @param checks - Array of permission checks
   * @returns true if user has at least one of the permissions
   */
  const canAny = useCallback(
    (checks: Array<{ action: Action; resource: ResourceType; scope?: Scope }>): boolean => {
      return checks.some((check) => can(check.action, check.resource, check.scope ?? Scopes.ALL));
    },
    [can],
  );

  /**
   * Check if user has ALL of the specified permissions.
   *
   * @param checks - Array of permission checks
   * @returns true if user has all of the permissions
   */
  const canAll = useCallback(
    (checks: Array<{ action: Action; resource: ResourceType; scope?: Scope }>): boolean => {
      return checks.every((check) => can(check.action, check.resource, check.scope ?? Scopes.ALL));
    },
    [can],
  );

  /**
   * Check if user has a specific role by slug.
   *
   * @param roleSlug - Role slug to check (e.g., 'instructor', 'admin')
   * @returns true if user has the role
   */
  const hasRole = useCallback(
    (roleSlug: string): boolean => {
      return roles.some((role) => role.slug === roleSlug);
    },
    [roles],
  );

  /**
   * Check if user has ANY of the specified roles.
   *
   * @param roleSlugs - Array of role slugs to check
   * @returns true if user has at least one of the roles
   */
  const hasAnyRole = useCallback(
    (roleSlugs: string[]): boolean => {
      return roles.some((role) => roleSlugs.includes(role.slug));
    },
    [roles],
  );

  // Computed role flags
  const isAdmin = useMemo(() => roles.some((role) => isAdminRole(role.slug)), [roles]);
  const isSuperAdmin = useMemo(() => hasRole('super-admin'), [hasRole]);
  const isInstructor = useMemo(() => roles.some((role) => isInstructorOrHigher(role.slug)), [roles]);

  // Convenience flags for common permissions
  const canUpdate = useMemo(() => {
    if (options?.resource) {
      return options.resource.can_update ?? false;
    }
    if (permissions.can_update !== undefined) {
      return permissions.can_update;
    }
    if (options?.resourceType) {
      return can(Actions.UPDATE, options.resourceType, Scopes.OWN);
    }
    return false;
  }, [permissions, options, can]);

  const canDelete = useMemo(() => {
    if (options?.resource) {
      return options.resource.can_delete ?? false;
    }
    if (permissions.can_delete !== undefined) {
      return permissions.can_delete;
    }
    if (options?.resourceType) {
      return can(Actions.DELETE, options.resourceType, Scopes.OWN);
    }
    return false;
  }, [permissions, options, can]);

  const canCreate = useMemo(() => {
    if (options?.resource) {
      return options.resource.can_create ?? false;
    }
    if (permissions.can_create !== undefined) {
      return permissions.can_create;
    }
    if (options?.resourceType) {
      return can(Actions.CREATE, options.resourceType, Scopes.ORG);
    }
    return false;
  }, [permissions, options, can]);

  const canRead = useMemo(() => {
    if (options?.resource) {
      return options.resource.can_read ?? false;
    }
    if (permissions.can_read !== undefined) {
      return permissions.can_read;
    }
    if (options?.resourceType) {
      return can(Actions.READ, options.resourceType, Scopes.ALL);
    }
    return false;
  }, [permissions, options, can]);

  const canManage = useMemo(() => {
    if (options?.resource) {
      return options.resource.can_manage ?? false;
    }
    if (permissions.can_manage !== undefined) {
      return permissions.can_manage;
    }
    if (options?.resourceType) {
      return can(Actions.MANAGE, options.resourceType, Scopes.ORG);
    }
    return false;
  }, [permissions, options, can]);

  const canModerate = useMemo(() => {
    if (options?.resource) {
      return options.resource.can_moderate ?? false;
    }
    if (permissions.can_moderate !== undefined) {
      return permissions.can_moderate;
    }
    if (options?.resourceType) {
      return can(Actions.MODERATE, options.resourceType, Scopes.ORG);
    }
    return false;
  }, [permissions, options, can]);

  const canPublish = useMemo(() => {
    if (options?.resource) {
      return options.resource.can_publish ?? false;
    }
    if (permissions.can_publish !== undefined) {
      return permissions.can_publish;
    }
    if (options?.resourceType) {
      return can(Actions.MANAGE, options.resourceType, Scopes.ORG);
    }
    return false;
  }, [permissions, options, can]);

  const canGrade = useMemo(() => {
    if (options?.resource) {
      return options.resource.can_grade ?? false;
    }
    if (permissions.can_grade !== undefined) {
      return permissions.can_grade;
    }
    if (options?.resourceType) {
      return can(Actions.GRADE, options.resourceType, Scopes.ORG);
    }
    return false;
  }, [permissions, options, can]);

  const isOwner = useMemo(() => {
    if (options?.resource) {
      return options.resource.is_owner ?? false;
    }
    return permissions.is_owner ?? false;
  }, [permissions, options]);

  const isCreator = useMemo(() => {
    if (options?.resource) {
      return options.resource.is_creator ?? false;
    }
    return permissions.is_creator ?? false;
  }, [permissions, options]);

  const isContributor = useMemo(() => {
    if (options?.resource) {
      return options.resource.is_contributor ?? false;
    }
    return permissions.is_contributor ?? false;
  }, [permissions, options]);

  const availableActions = useMemo(() => {
    if (options?.resource) {
      return options.resource.available_actions ?? [];
    }
    return (permissions.available_actions as string[]) ?? [];
  }, [permissions, options]);

  /**
   * Check if a specific action is available.
   *
   * @param action - Action name to check
   * @returns true if action is available
   */
  const hasAction = useCallback(
    (action: string): boolean => {
      return availableActions.includes(action);
    },
    [availableActions],
  );

  /**
   * Check if ANY of the specified actions are available.
   *
   * @param actions - Array of action names
   * @returns true if at least one action is available
   */
  const hasAnyAction = useCallback(
    (actions: string[]): boolean => {
      return actions.some((action) => availableActions.includes(action));
    },
    [availableActions],
  );

  const isLoading = options?.resource ? false : isLoadingApi;

  return {
    // Core permission checking
    can,
    canAny,
    canAll,

    // Role checking
    hasRole,
    hasAnyRole,
    roles,
    isAdmin,
    isSuperAdmin,
    isInstructor,

    // Convenience flags
    canUpdate,
    canDelete,
    canCreate,
    canRead,
    canManage,
    canModerate,
    canPublish,
    canGrade,

    // Ownership/authorship
    isOwner,
    isCreator,
    isContributor,

    // Available actions
    availableActions,
    hasAction,
    hasAnyAction,

    // State
    loading: isLoading,
    error,
    permissions,
  };
}

/**
 * Legacy compatibility: Extract permissions from resource metadata.
 *
 * This is a convenience wrapper for the unified hook when you only
 * need to extract metadata from an enriched API response.
 *
 * @deprecated Use `usePermissions({ resource })` instead
 */
export function useResourcePermissions<T extends ResourceWithPermissions>(
  resource: T | null | undefined,
) {
  return usePermissions({ resource });
}
