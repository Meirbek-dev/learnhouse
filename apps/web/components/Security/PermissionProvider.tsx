'use client';

/**
 * Centralized Permission Provider
 *
 * This provider consolidates all permission logic into a single source of truth.
 * It handles:
 * - Global permissions (org-level)
 * - Resource-specific permissions
 * - Server-supplied permissions (SSR support)
 * - Caching and batching
 * - Permission invalidation
 */

import { createContext, useContext, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { getAPIUrl } from '@/services/config/config';
import {
  Scopes,
  RoleSlugs,
  buildPermissionName,
  isAdminRole,
  isInstructorOrHigher,
} from '@/types/permissions';
import type { Action, ResourceType, Scope, Role } from '@/types/permissions';

// ============================================================================
// Types
// ============================================================================

interface UserPermissionsResponse {
  user_id: number;
  org_id: number | null;
  roles: Role[];
  permissions: Record<string, boolean>;
  resource_permissions?: any[];
}

interface ResourcePermissionResponse {
  resource_id: string;
  resource_type: ResourceType;
  permissions: Record<string, boolean>;
  user_is_owner: boolean;
  available_actions: Action[];
}

interface PermissionContextValue {
  // Core permission checking
  can: (action: Action, resource: ResourceType, scope?: Scope) => boolean;
  canAny: (checks: Array<{ action: Action; resource: ResourceType; scope?: Scope }>) => boolean;
  canAll: (checks: Array<{ action: Action; resource: ResourceType; scope?: Scope }>) => boolean;

  // Role checking
  hasRole: (roleSlug: string) => boolean;
  hasAnyRole: (roleSlugs: string[]) => boolean;
  roles: Role[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isInstructor: boolean;

  // State
  loading: boolean;
  error: any;
  permissions: Record<string, boolean>;

  // Cache management
  invalidate: () => void;
  prefetch: (resourceType?: ResourceType, resourceId?: string) => Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

const PermissionContext = createContext<PermissionContextValue | null>(null);

// ============================================================================
// Provider Props
// ============================================================================

interface PermissionProviderProps {
  children: ReactNode;
  /**
   * Organization ID for scoped permissions.
   * If not provided, will attempt to use from session context.
   */
  orgId?: number;
  /**
   * Server-supplied permissions for SSR.
   * When provided, the provider will use these instead of fetching.
   */
  initialPermissions?: UserPermissionsResponse;
}

// ============================================================================
// Fetcher
// ============================================================================

async function permissionFetcher(
  url: string,
  accessToken?: string,
): Promise<UserPermissionsResponse> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, { headers, credentials: 'include' });

  if (!response.ok) {
    throw new Error(`Failed to fetch permissions: ${response.statusText}`);
  }

  return response.json();
}

// ============================================================================
// Provider Component
// ============================================================================

export function PermissionProvider({
  children,
  orgId,
  initialPermissions,
}: PermissionProviderProps) {
  const { data: session, status } = useSession();
  const accessToken = session?.tokens?.access_token;

  // Build endpoint
  const endpoint = useMemo(() => {
    const orgParam = orgId ? `?org_id=${orgId}` : '';
    return `${getAPIUrl()}me/permissions${orgParam}`;
  }, [orgId]);

  // Fetch permissions (skip if we have initial data from server)
  const shouldFetch = status === 'authenticated' && accessToken && !initialPermissions;

  const {
    data: apiData,
    error,
    isLoading: isLoadingApi,
    mutate,
  } = useSWR(
    shouldFetch ? endpoint : null,
    (url: string) => permissionFetcher(url, accessToken),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60_000, // Cache for 1 minute
      fallbackData: initialPermissions,
    },
  );

  // Use either fetched data or initial server data
  const data = apiData || initialPermissions;

  // Extract permissions and roles
  const permissions = useMemo(() => data?.permissions ?? {}, [data]);
  const roles = useMemo(() => data?.roles ?? [], [data]);

  // Core permission check
  const can = useCallback(
    (action: Action, resource: ResourceType, scope: Scope = Scopes.ALL): boolean => {
      if (!session) return false;
      const permissionName = buildPermissionName(resource, action, scope);
      return permissions[permissionName] === true;
    },
    [session, permissions],
  );

  // Check if user has ANY of the specified permissions
  const canAny = useCallback(
    (checks: Array<{ action: Action; resource: ResourceType; scope?: Scope }>): boolean => {
      return checks.some((check) => can(check.action, check.resource, check.scope ?? Scopes.ALL));
    },
    [can],
  );

  // Check if user has ALL of the specified permissions
  const canAll = useCallback(
    (checks: Array<{ action: Action; resource: ResourceType; scope?: Scope }>): boolean => {
      return checks.every((check) => can(check.action, check.resource, check.scope ?? Scopes.ALL));
    },
    [can],
  );

  // Role checks
  const hasRole = useCallback(
    (roleSlug: string): boolean => {
      return roles.some((role) => role.slug === roleSlug);
    },
    [roles],
  );

  const hasAnyRole = useCallback(
    (roleSlugs: string[]): boolean => {
      return roles.some((role) => roleSlugs.includes(role.slug));
    },
    [roles],
  );

  // Computed role flags
  const isAdmin = useMemo(() => roles.some((role) => isAdminRole(role.slug)), [roles]);
  const isSuperAdmin = useMemo(() => hasRole(RoleSlugs.SUPER_ADMIN), [hasRole]);
  const isInstructor = useMemo(() => roles.some((role) => isInstructorOrHigher(role.slug)), [roles]);

  // Cache management
  const invalidate = useCallback(() => {
    mutate();
  }, [mutate]);

  const prefetch = useCallback(
    async (resourceType?: ResourceType, resourceId?: string) => {
      // Prefetch resource-specific permissions if needed
      if (resourceType && resourceId) {
        const resourceEndpoint = `${getAPIUrl()}permissions/resource/${resourceType}/${resourceId}${
          orgId ? `?org_id=${orgId}` : ''
        }`;
        await fetch(resourceEndpoint, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
      }
    },
    [accessToken, orgId],
  );

  const value: PermissionContextValue = {
    can,
    canAny,
    canAll,
    hasRole,
    hasAnyRole,
    roles,
    isAdmin,
    isSuperAdmin,
    isInstructor,
    loading: isLoadingApi,
    error,
    permissions,
    invalidate,
    prefetch,
  };

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
 * if (can(Actions.CREATE, ResourceTypes.COURSE)) {
 *   // Show create button
 * }
 * ```
 */
export function usePermissions() {
  const context = useContext(PermissionContext);

  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }

  return context;
}
