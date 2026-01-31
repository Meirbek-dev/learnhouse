'use client';

/**
 * Hook for consuming backend permission metadata from API responses.
 *
 * This hook provides a clean interface to work with permission metadata
 * that comes from enriched API responses. Instead of calling the permission
 * API directly, this hook reads the metadata that's already included in
 * the resource data.
 *
 * @example
 * ```tsx
 * const collection = { ...collectionData, can_update: true, can_delete: false };
 * const { canUpdate, canDelete, isOwner, availableActions } = useResourcePermissions(collection);
 *
 * <Button disabled={!canUpdate}>Edit</Button>
 * <Button disabled={!canDelete}>Delete</Button>
 * {isOwner && <Badge>Owner</Badge>}
 * ```
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

export interface ResourcePermissions {
  canUpdate: boolean;
  canDelete: boolean;
  canCreate: boolean;
  canRead: boolean;
  canManage: boolean;
  canModerate: boolean;
  canPublish: boolean;
  canGrade: boolean;
  isOwner: boolean;
  isCreator: boolean;
  isContributor: boolean;
  availableActions: string[];
  hasAction: (action: string) => boolean;
  hasAnyAction: (...actions: string[]) => boolean;
  hasAllActions: (...actions: string[]) => boolean;
}

/**
 * Extract and normalize permission metadata from a resource.
 *
 * @param resource - Resource with optional permission metadata from backend
 * @returns Normalized permission object with camelCase properties
 */
export function useResourcePermissions<T extends ResourceWithPermissions>(
  resource: T | null | undefined
): ResourcePermissions {
  const availableActions = resource?.available_actions ?? [];

  const hasAction = (action: string): boolean => {
    return availableActions.includes(action);
  };

  const hasAnyAction = (...actions: string[]): boolean => {
    return actions.some((action) => availableActions.includes(action));
  };

  const hasAllActions = (...actions: string[]): boolean => {
    return actions.every((action) => availableActions.includes(action));
  };

  return {
    canUpdate: resource?.can_update ?? false,
    canDelete: resource?.can_delete ?? false,
    canCreate: resource?.can_create ?? false,
    canRead: resource?.can_read ?? true, // Most resources are readable if you have them
    canManage: resource?.can_manage ?? false,
    canModerate: resource?.can_moderate ?? false,
    canPublish: resource?.can_publish ?? false,
    canGrade: resource?.can_grade ?? false,
    isOwner: resource?.is_owner ?? false,
    isCreator: resource?.is_creator ?? false,
    isContributor: resource?.is_contributor ?? false,
    availableActions,
    hasAction,
    hasAnyAction,
    hasAllActions,
  };
}

export default useResourcePermissions;
