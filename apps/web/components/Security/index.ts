/**
 * RBAC Security Components
 *
 * This module exports all permission and role-related components
 * for the new RBAC system.
 *
 * CANONICAL API - All permission-related imports should use this module.
 */

// Core provider and hook
export { PermissionProvider } from './PermissionProvider';
export { usePermissions } from '@/hooks/usePermissions';
export type { UsePermissionsOptions, ResourceWithPermissions } from '@/hooks/usePermissions';

// UI Components
export { PermissionDenied } from './PermissionDenied';
export { PermissionGuard } from './PermissionGuard';
export { RoleHierarchyTree } from './RoleHierarchyTree';
export { AdminGuard } from './AdminGuard';

// Re-export types
export type { Action, ResourceType, Scope, Role, Permission } from '@/types/permissions';
export { Actions, ResourceTypes, Scopes, RoleSlugs } from '@/types/permissions';
