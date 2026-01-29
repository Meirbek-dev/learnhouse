'use client';

import type { Action, ResourceType, Scope } from '@/types/permissions';
import { getAPIUrl } from '@/services/config/config';
import { Actions } from '@/types/permissions';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';

interface ResourcePermissionResponse {
  resource_id: string;
  resource_type: ResourceType;
  permissions: Record<string, boolean>;
  user_is_owner: boolean;
  available_actions: Action[];
}

/**
 * SWR fetcher for resource permissions.
 */
async function resourcePermissionFetcher(url: string, accessToken?: string): Promise<ResourcePermissionResponse> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch resource permissions: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Hook for checking permissions on a specific resource.
 *
 * This hook fetches resource-specific permissions and provides
 * convenient methods to check what actions are allowed.
 *
 * @param resourceType - Type of resource (course, organization, etc.)
 * @param resourceId - UUID of the specific resource
 * @param orgId - Optional organization ID for context
 *
 * @example
 * ```tsx
 * const {
 *   canRead,
 *   canUpdate,
 *   canDelete,
 *   isOwner,
 *   availableActions,
 *   loading
 * } = useResourcePermission(ResourceTypes.COURSE, courseUuid, orgId)
 *
 * if (canUpdate) {
 *   // Show edit button
 * }
 * ```
 */
export function useResourcePermission(resourceType: ResourceType, resourceId?: string, orgId?: number) {
  const { data: session, status } = useSession();

  const accessToken = session?.tokens?.access_token;
  const shouldFetch = status === 'authenticated' && accessToken && resourceId;

  const url = shouldFetch
    ? `${getAPIUrl()}permissions/resource/${resourceType}/${resourceId}${orgId ? `?org_id=${orgId}` : ''}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<ResourcePermissionResponse>(
    url,
    (url: string) => resourcePermissionFetcher(url, accessToken),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30_000, // Cache for 30 seconds
    },
  );

  const permissions = data?.permissions ?? {};
  const availableActions = data?.available_actions ?? [];
  const isOwner = data?.user_is_owner ?? false;

  /**
   * Check if user can perform a specific action on this resource.
   */
  const can = (action: Action, scope?: Scope): boolean => {
    if (!data) return false;

    // Check if action is in available actions
    if (availableActions.includes(action)) {
      return true;
    }

    // Check specific permission
    const permName = scope ? `${resourceType}:${action}:${scope}` : `${resourceType}:${action}:all`;
    return permissions[permName] === true;
  };

  // Common permission checks
  const canRead = can(Actions.READ);
  const canCreate = can(Actions.CREATE);
  const canUpdate = can(Actions.UPDATE);
  const canDelete = can(Actions.DELETE);
  const canManage = can(Actions.MANAGE);
  const canModerate = can(Actions.MODERATE);
  const canExport = can(Actions.EXPORT);

  /**
   * Refresh resource permissions (useful after role changes).
   */
  const refresh = () => mutate();

  return {
    // Permission checks
    can,
    canRead,
    canCreate,
    canUpdate,
    canDelete,
    canManage,
    canModerate,
    canExport,

    // Metadata
    isOwner,
    availableActions,
    permissions,

    // State
    loading: isLoading,
    error,
    refresh,
  };
}

export default useResourcePermission;
