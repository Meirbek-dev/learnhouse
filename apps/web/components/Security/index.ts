/**
 * RBAC Security Components
 *
 * This module exports all permission and role-related components
 * for the new RBAC system.
 */

export { PermissionDenied } from './PermissionDenied';
export { RoleHierarchyTree } from './RoleHierarchyTree';

// Re-export unified permission hook
export { usePermissions } from '@/hooks/usePermissions';


// Re-export types
export type { Action, ResourceType, Scope } from '@/types/permissions';
export { Actions, ResourceTypes, Scopes } from '@/types/permissions';
