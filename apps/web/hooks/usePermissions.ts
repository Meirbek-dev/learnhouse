'use client';

/**
 * usePermissions Hook
 *
 * Extended hook that wraps the base PermissionProvider with:
 * - Metadata extraction from enriched API responses (can_update, is_owner, etc.)
 * - Convenience flags for common permissions
 */

import { useMemo, useCallback } from 'react';
import { usePermissions as useBasePermissions } from '@/components/Security/PermissionProvider';
import { Actions, Scopes } from '@/types/permissions';
import type { ResourceType } from '@/types/permissions';

// ============================================================================
// Types
// ============================================================================

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
  can_grade?: boolean;
  can_enroll?: boolean;
  can_export?: boolean;
  can_invite?: boolean;
  can_submit?: boolean;
  is_owner?: boolean;
  is_creator?: boolean;
  is_contributor?: boolean;
  is_member?: boolean;
  available_actions?: string[];
}

export interface UsePermissionsOptions {
  /**
   * Resource type for fallback permission checks.
   */
  resourceType?: ResourceType;

  /**
   * Organization ID for scoped checks.
   */
  orgId?: number;

  /**
   * Pre-fetched resource with embedded permission metadata.
   * When provided, the hook extracts permissions from this object.
   */
  resource?: ResourceWithPermissions | null | undefined;
}

/**
 * Permission hook with resource-specific features.
 *
 * @example
 * ```tsx
 * // Global permission check
 * const { can, isAdmin } = usePermissions();
 *
 * // From enriched API response (no extra fetch)
 * const course = { ...courseData, can_update: true, is_owner: false };
 * const { canUpdate, isOwner } = usePermissions({ resource: course });
 * ```
 */
export function usePermissions(options?: UsePermissionsOptions) {
  const basePermissions = useBasePermissions();

  // Extract permissions from embedded resource metadata (if provided)
  const extracted = useMemo(() => {
    if (!options?.resource) return null;
    return {
      can_update: options.resource.can_update ?? false,
      can_delete: options.resource.can_delete ?? false,
      can_create: options.resource.can_create ?? false,
      can_read: options.resource.can_read ?? false,
      can_manage: options.resource.can_manage ?? false,
      can_moderate: options.resource.can_moderate ?? false,
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
  }, [options?.resource]);

  // Convenience flags: prefer embedded metadata, fall back to global permissions
  const canUpdate = useMemo(() => {
    if (extracted?.can_update !== undefined) return extracted.can_update;
    if (options?.resourceType) return basePermissions.can(Actions.UPDATE, options.resourceType, Scopes.OWN);
    return false;
  }, [extracted, options?.resourceType, basePermissions]);

  const canDelete = useMemo(() => {
    if (extracted?.can_delete !== undefined) return extracted.can_delete;
    if (options?.resourceType) return basePermissions.can(Actions.DELETE, options.resourceType, Scopes.OWN);
    return false;
  }, [extracted, options?.resourceType, basePermissions]);

  const canCreate = useMemo(() => {
    if (extracted?.can_create !== undefined) return extracted.can_create;
    if (options?.resourceType) return basePermissions.can(Actions.CREATE, options.resourceType, Scopes.ORG);
    return false;
  }, [extracted, options?.resourceType, basePermissions]);

  const canRead = useMemo(() => {
    if (extracted?.can_read !== undefined) return extracted.can_read;
    if (options?.resourceType) return basePermissions.can(Actions.READ, options.resourceType, Scopes.ALL);
    return false;
  }, [extracted, options?.resourceType, basePermissions]);

  const canManage = useMemo(() => {
    if (extracted?.can_manage !== undefined) return extracted.can_manage;
    if (options?.resourceType) return basePermissions.can(Actions.MANAGE, options.resourceType, Scopes.ORG);
    return false;
  }, [extracted, options?.resourceType, basePermissions]);

  const canModerate = useMemo(() => extracted?.can_moderate ?? false, [extracted]);
  const canGrade = useMemo(() => extracted?.can_grade ?? false, [extracted]);
  const canEnroll = useMemo(() => extracted?.can_enroll ?? false, [extracted]);
  const canExport = useMemo(() => extracted?.can_export ?? false, [extracted]);
  const canInvite = useMemo(() => extracted?.can_invite ?? false, [extracted]);
  const canSubmit = useMemo(() => extracted?.can_submit ?? false, [extracted]);

  const isOwner = useMemo(() => extracted?.is_owner ?? false, [extracted]);
  const isCreator = useMemo(() => extracted?.is_creator ?? false, [extracted]);
  const isContributor = useMemo(() => extracted?.is_contributor ?? false, [extracted]);
  const isMember = useMemo(() => extracted?.is_member ?? false, [extracted]);

  const availableActions = useMemo(() => extracted?.available_actions ?? [], [extracted]);

  const hasAction = useCallback(
    (action: string): boolean => availableActions.includes(action),
    [availableActions],
  );

  const hasAnyAction = useCallback(
    (actions: string[]): boolean => actions.some((a) => availableActions.includes(a)),
    [availableActions],
  );

  return {
    ...basePermissions,
    canUpdate,
    canDelete,
    canCreate,
    canRead,
    canManage,
    canModerate,
    canGrade,
    canEnroll,
    canExport,
    canInvite,
    canSubmit,
    isOwner,
    isCreator,
    isContributor,
    isMember,
    availableActions,
    hasAction,
    hasAnyAction,
    loading: options?.resource ? false : basePermissions.loading,
    error: basePermissions.error,
  };
}
