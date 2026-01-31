/**
 * RBAC Security Components
 *
 * This module exports all permission and role-related components
 * for the new RBAC system.
 */

export { PermissionDenied } from './PermissionDenied';
export { RoleHierarchyTree } from './RoleHierarchyTree';

// Re-export hooks from hooks directory
export { default as usePermission } from '@/hooks/usePermission';
export { default as useResourcePermission } from '@/hooks/useResourcePermission';

// Re-export types
export type { Action, ResourceType, Scope } from '@/types/permissions';
export { Actions, ResourceTypes, Scopes } from '@/types/permissions';
