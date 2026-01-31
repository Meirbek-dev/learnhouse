/**
 * Permission types for the RBAC system.
 *
 * This module provides TypeScript types that mirror the backend permission system,
 * enabling type-safe permission checks in the frontend.
 *
 * NOTE: Actions, ResourceTypes, Scopes, and RoleSlugs are now imported from
 * generated_permissions.ts which is auto-generated from the YAML schema.
 * This file contains only the interfaces and helper functions.
 */

import { Actions, ResourceTypes, Scopes, RoleSlugs } from './generated_permissions';
import type { Action, ResourceType, Scope, RoleSlug } from './generated_permissions';

// Re-export the generated types for convenience
export { Actions, ResourceTypes, Scopes, RoleSlugs };
export type { Action, ResourceType, Scope, RoleSlug };

/**
 * Permission definition.
 */
export interface Permission {
  id: number;
  name: string;
  resource_type: ResourceType;
  action: Action;
  scope: Scope;
  description?: string;
  created_at: string;
}

/**
 * Role definition.
 */
export interface Role {
  id: number;
  name: string;
  slug: string;
  description?: string;
  org_id?: number | null;
  parent_role_id?: number | null;
  is_system: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

/**
 * Role with its assigned permissions.
 */
export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

/**
 * User-role assignment.
 */
export interface UserRole {
  user_id: number;
  role_id: number;
  org_id: number;
  granted_at: string;
  granted_by?: number | null;
  expires_at?: string | null;
  role?: Role;
}

/**
 * Resource-level permission override.
 */
export interface ResourcePermission {
  id: number;
  user_id: number;
  resource_type: ResourceType;
  resource_id: string;
  permission_id: number;
  granted_at: string;
  granted_by?: number | null;
  expires_at?: string | null;
}

/**
 * User's effective permissions response from API.
 */
export interface UserPermissionsResponse {
  user_id: number;
  org_id?: number | null;
  roles: Role[];
  permissions: Record<string, boolean>;
  resource_permissions: ResourcePermission[];
}

/**
 * Build a permission name from components.
 */
export function buildPermissionName(resource: ResourceType, action: Action, scope: Scope = Scopes.ALL): string {
  return `${resource}:${action}:${scope}`;
}

/**
 * Parse a permission name into components.
 */
export function parsePermissionName(name: string): { resource: ResourceType; action: Action; scope: Scope } | null {
  const parts = name.split(':');
  if (parts.length !== 3) return null;

  return {
    resource: parts[0] as ResourceType,
    action: parts[1] as Action,
    scope: parts[2] as Scope,
  };
}

/**
 * Common permission names for quick access.
 */
export const CommonPermissions = {
  // Course permissions
  COURSE_CREATE: buildPermissionName(ResourceTypes.COURSE, Actions.CREATE, Scopes.ORG),
  COURSE_READ: buildPermissionName(ResourceTypes.COURSE, Actions.READ, Scopes.ALL),
  COURSE_UPDATE_OWN: buildPermissionName(ResourceTypes.COURSE, Actions.UPDATE, Scopes.OWN),
  COURSE_DELETE_OWN: buildPermissionName(ResourceTypes.COURSE, Actions.DELETE, Scopes.OWN),
  COURSE_MANAGE_OWN: buildPermissionName(ResourceTypes.COURSE, Actions.MANAGE, Scopes.OWN),

  // Organization permissions
  ORG_READ: buildPermissionName(ResourceTypes.ORGANIZATION, Actions.READ, Scopes.OWN),
  ORG_UPDATE: buildPermissionName(ResourceTypes.ORGANIZATION, Actions.UPDATE, Scopes.OWN),
  ORG_MANAGE: buildPermissionName(ResourceTypes.ORGANIZATION, Actions.MANAGE, Scopes.OWN),

  // User permissions
  USER_READ_OWN: buildPermissionName(ResourceTypes.USER, Actions.READ, Scopes.OWN),
  USER_UPDATE_OWN: buildPermissionName(ResourceTypes.USER, Actions.UPDATE, Scopes.OWN),
  USER_READ_ORG: buildPermissionName(ResourceTypes.USER, Actions.READ, Scopes.ORG),
  USER_INVITE: buildPermissionName(ResourceTypes.USER, Actions.INVITE, Scopes.ORG),

  // Role permissions
  ROLE_CREATE: buildPermissionName(ResourceTypes.ROLE, Actions.CREATE, Scopes.ORG),
  ROLE_READ: buildPermissionName(ResourceTypes.ROLE, Actions.READ, Scopes.ORG),
  ROLE_UPDATE: buildPermissionName(ResourceTypes.ROLE, Actions.UPDATE, Scopes.ORG),
  ROLE_DELETE: buildPermissionName(ResourceTypes.ROLE, Actions.DELETE, Scopes.ORG),

  // Analytics permissions
  ANALYTICS_READ_OWN: buildPermissionName(ResourceTypes.ANALYTICS, Actions.READ, Scopes.OWN),
  ANALYTICS_READ_ORG: buildPermissionName(ResourceTypes.ANALYTICS, Actions.READ, Scopes.ORG),
} as const;

/**
 * Check if a role is an admin role.
 */
export function isAdminRole(roleSlug: string): boolean {
  return roleSlug === RoleSlugs.SUPER_ADMIN || roleSlug === RoleSlugs.ORG_ADMIN;
}

/**
 * Check if a role has instructor-level access.
 */
export function isInstructorOrHigher(roleSlug: string): boolean {
  const instructorOrHigher: string[] = [
    RoleSlugs.SUPER_ADMIN,
    RoleSlugs.ORG_ADMIN,
    RoleSlugs.MAINTAINER,
    RoleSlugs.INSTRUCTOR,
  ];
  return instructorOrHigher.includes(roleSlug);
}
