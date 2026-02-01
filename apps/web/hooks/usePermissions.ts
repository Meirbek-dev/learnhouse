'use client';

/**
 * usePermissions Hook
 *
 * This hook extends the base PermissionProvider with resource-specific features:
 * - Resource-specific permission fetching
 * - Metadata extraction from enriched API responses
 * - Convenience flags for common permissions
 */

import { useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { getAPIUrl } from '@/services/config/config';
import { usePermissions as useBasePermissions } from '@/components/Security/PermissionProvider';
import { Actions, Scopes } from '@/types/permissions';
import type { Action, ResourceType } from '@/types/permissions';

// ============================================================================
// Types
// ============================================================================

/**
 * Resource with permission metadata from enriched API responses.
 */
export interface ResourceWithPermissions {
  // Basic CRUD permissions
  can_update?: boolean;
  can_delete?: boolean;
  can_create?: boolean;
  can_read?: boolean;

  // Extended permissions
  can_manage?: boolean;
  can_moderate?: boolean;
  can_publish?: boolean;
  can_grade?: boolean;
  can_enroll?: boolean;
  can_export?: boolean;
  can_invite?: boolean;
  can_submit?: boolean;
  can_manage_contributors?: boolean;

  // Ownership/authorship flags
  is_owner?: boolean;
  is_creator?: boolean;
  is_contributor?: boolean;
  is_member?: boolean;

  // Available actions array
  available_actions?: string[];
}

interface ResourcePermissionResponse {
  resource_id: string;
  resource_type: ResourceType;
  permissions: Record<string, boolean>;
  user_is_owner: boolean;
  available_actions: Action[];
}

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

// ============================================================================
// Fetcher
// ============================================================================

async function resourcePermissionFetcher(
  url: string,
  accessToken?: string,
): Promise<ResourcePermissionResponse> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, { headers, credentials: 'include' });

  if (!response.ok) {
    throw new Error(`Failed to fetch resource permissions: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Permission hook with resource-specific features.
 *
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * // Global permission check
 * const { can, isAdmin } = usePermissions();
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
  // Get base permissions from provider
  const basePermissions = useBasePermissions();
  const { data: session } = useSession();
  const accessToken = session?.tokens?.access_token;

  // Determine if we need to fetch resource-specific permissions
  const shouldFetchResource =
    options?.resourceType && options?.resourceId && !options?.resource && accessToken;

  // Build endpoint for resource-specific permissions
  const resourceEndpoint = useMemo(() => {
    if (!shouldFetchResource) return null;
    const orgParam = options?.orgId ? `?org_id=${options.orgId}` : '';
    return `${getAPIUrl()}permissions/resource/${options.resourceType}/${options.resourceId}${orgParam}`;
  }, [shouldFetchResource, options?.resourceType, options?.resourceId, options?.orgId]);

  // Fetch resource-specific permissions
  const {
    data: resourceData,
    error: resourceError,
    isLoading: isLoadingResource,
  } = useSWR(
    resourceEndpoint,
    (url: string) => resourcePermissionFetcher(url, accessToken),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60_000,
    },
  );

  // Extract permissions based on priority:
  // 1. Embedded metadata from resource prop
  // 2. Fetched resource-specific permissions
  // 3. Global permissions from provider
  const extractedPermissions = useMemo(() => {
    // Priority 1: Embedded metadata
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
        can_enroll: options.resource.can_enroll ?? false,
        can_export: options.resource.can_export ?? false,
        can_invite: options.resource.can_invite ?? false,
        can_submit: options.resource.can_submit ?? false,
        is_owner: options.resource.is_owner ?? false,
        is_creator: options.resource.is_creator ?? false,
        is_contributor: options.resource.is_contributor ?? false,
        is_member: options.resource.is_member ?? false,
        available_actions: options.resource.available_actions ?? [],
      };
    }

    // Priority 2: Fetched resource permissions
    if (resourceData) {
      return {
        ...resourceData.permissions,
        is_owner: resourceData.user_is_owner,
        available_actions: resourceData.available_actions,
      };
    }

    // Priority 3: Global permissions
    return {};
  }, [options?.resource, resourceData]);

  // Convenience flags with fallback to global permissions
  const canUpdate = useMemo(() => {
    if (extractedPermissions.can_update !== undefined) {
      return extractedPermissions.can_update;
    }
    if (options?.resourceType) {
      return basePermissions.can(Actions.UPDATE, options.resourceType, Scopes.OWN);
    }
    return false;
  }, [extractedPermissions, options?.resourceType, basePermissions]);

  const canDelete = useMemo(() => {
    if (extractedPermissions.can_delete !== undefined) {
      return extractedPermissions.can_delete;
    }
    if (options?.resourceType) {
      return basePermissions.can(Actions.DELETE, options.resourceType, Scopes.OWN);
    }
    return false;
  }, [extractedPermissions, options?.resourceType, basePermissions]);

  const canCreate = useMemo(() => {
    if (extractedPermissions.can_create !== undefined) {
      return extractedPermissions.can_create;
    }
    if (options?.resourceType) {
      return basePermissions.can(Actions.CREATE, options.resourceType, Scopes.ORG);
    }
    return false;
  }, [extractedPermissions, options?.resourceType, basePermissions]);

  const canRead = useMemo(() => {
    if (extractedPermissions.can_read !== undefined) {
      return extractedPermissions.can_read;
    }
    if (options?.resourceType) {
      return basePermissions.can(Actions.READ, options.resourceType, Scopes.ALL);
    }
    return false;
  }, [extractedPermissions, options?.resourceType, basePermissions]);

  const canManage = useMemo(() => {
    if (extractedPermissions.can_manage !== undefined) {
      return extractedPermissions.can_manage;
    }
    if (options?.resourceType) {
      return basePermissions.can(Actions.MANAGE, options.resourceType, Scopes.ORG);
    }
    return false;
  }, [extractedPermissions, options?.resourceType, basePermissions]);

  const canModerate = useMemo(() => extractedPermissions.can_moderate ?? false, [extractedPermissions]);
  const canPublish = useMemo(() => extractedPermissions.can_publish ?? false, [extractedPermissions]);
  const canGrade = useMemo(() => extractedPermissions.can_grade ?? false, [extractedPermissions]);
  const canEnroll = useMemo(() => extractedPermissions.can_enroll ?? false, [extractedPermissions]);
  const canExport = useMemo(() => extractedPermissions.can_export ?? false, [extractedPermissions]);
  const canInvite = useMemo(() => extractedPermissions.can_invite ?? false, [extractedPermissions]);
  const canSubmit = useMemo(() => extractedPermissions.can_submit ?? false, [extractedPermissions]);

  // Ownership flags
  const isOwner = useMemo(() => extractedPermissions.is_owner ?? false, [extractedPermissions]);
  const isCreator = useMemo(() => extractedPermissions.is_creator ?? false, [extractedPermissions]);
  const isContributor = useMemo(() => extractedPermissions.is_contributor ?? false, [extractedPermissions]);
  const isMember = useMemo(() => extractedPermissions.is_member ?? false, [extractedPermissions]);

  // Available actions
  const availableActions = useMemo(
    () => (extractedPermissions.available_actions as string[]) ?? [],
    [extractedPermissions],
  );

  const hasAction = useCallback(
    (action: string): boolean => {
      return availableActions.includes(action);
    },
    [availableActions],
  );

  const hasAnyAction = useCallback(
    (actions: string[]): boolean => {
      return actions.some((action) => availableActions.includes(action));
    },
    [availableActions],
  );

  // Determine loading state
  const loading = options?.resource ? false : basePermissions.loading || isLoadingResource;
  const error = basePermissions.error || resourceError;

  return {
    // From base provider
    ...basePermissions,

    // Convenience flags
    canUpdate,
    canDelete,
    canCreate,
    canRead,
    canManage,
    canModerate,
    canPublish,
    canGrade,
    canEnroll,
    canExport,
    canInvite,
    canSubmit,

    // Ownership
    isOwner,
    isCreator,
    isContributor,
    isMember,

    // Available actions
    availableActions,
    hasAction,
    hasAnyAction,

    // State
    loading,
    error,
  };
}
