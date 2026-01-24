/**
 * Permission types for the RBAC system.
 *
 * This module provides TypeScript types that mirror the backend permission system,
 * enabling type-safe permission checks in the frontend.
 */

/**
 * Actions that can be performed on resources.
 */
export const Action = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  MANAGE: 'manage',
  MODERATE: 'moderate',
  EXPORT: 'export',
  INVITE: 'invite',
  GRADE: 'grade',
  SUBMIT: 'submit',
  ENROLL: 'enroll',
} as const

export type Action = (typeof Action)[keyof typeof Action]

/**
 * Types of resources in the system.
 */
export const ResourceType = {
  ORGANIZATION: 'organization',
  COURSE: 'course',
  CHAPTER: 'chapter',
  ACTIVITY: 'activity',
  ASSIGNMENT: 'assignment',
  QUIZ: 'quiz',
  USER: 'user',
  USERGROUP: 'usergroup',
  COLLECTION: 'collection',
  ROLE: 'role',
  CERTIFICATE: 'certificate',
  DISCUSSION: 'discussion',
  FILE: 'file',
  ANALYTICS: 'analytics',
  TRAIL: 'trail',
  EXAM: 'exam',
  PAYMENT: 'payment',
  API_TOKEN: 'api_token',
} as const

export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType]

/**
 * Scope of a permission.
 */
export const Scope = {
  ALL: 'all',
  OWN: 'own',
  ASSIGNED: 'assigned',
  ORG: 'org',
} as const

export type Scope = (typeof Scope)[keyof typeof Scope]

/**
 * Permission definition.
 */
export interface Permission {
  id: number
  name: string
  resource_type: ResourceType
  action: Action
  scope: Scope
  description?: string
  created_at: string
}

/**
 * Role definition.
 */
export interface Role {
  id: number
  name: string
  slug: string
  description?: string
  org_id?: number | null
  parent_role_id?: number | null
  is_system: boolean
  priority: number
  created_at: string
  updated_at: string
}

/**
 * Role with its assigned permissions.
 */
export interface RoleWithPermissions extends Role {
  permissions: Permission[]
}

/**
 * User-role assignment.
 */
export interface UserRole {
  user_id: number
  role_id: number
  org_id: number
  granted_at: string
  granted_by?: number | null
  expires_at?: string | null
  role?: Role
}

/**
 * Resource-level permission override.
 */
export interface ResourcePermission {
  id: number
  user_id: number
  resource_type: ResourceType
  resource_id: string
  permission_id: number
  granted_at: string
  granted_by?: number | null
  expires_at?: string | null
}

/**
 * User's effective permissions response from API.
 */
export interface UserPermissionsResponse {
  user_id: number
  org_id?: number | null
  roles: Role[]
  permissions: Record<string, boolean>
  resource_permissions: ResourcePermission[]
}

/**
 * Build a permission name from components.
 */
export function buildPermissionName(
  resource: ResourceType,
  action: Action,
  scope: Scope = Scope.ALL
): string {
  return `${resource}:${action}:${scope}`
}

/**
 * Parse a permission name into components.
 */
export function parsePermissionName(
  name: string
): { resource: ResourceType; action: Action; scope: Scope } | null {
  const parts = name.split(':')
  if (parts.length !== 3) return null

  return {
    resource: parts[0] as ResourceType,
    action: parts[1] as Action,
    scope: parts[2] as Scope,
  }
}

/**
 * Common permission names for quick access.
 */
export const CommonPermissions = {
  // Course permissions
  COURSE_CREATE: buildPermissionName(ResourceType.COURSE, Action.CREATE, Scope.ORG),
  COURSE_READ: buildPermissionName(ResourceType.COURSE, Action.READ, Scope.ALL),
  COURSE_UPDATE_OWN: buildPermissionName(ResourceType.COURSE, Action.UPDATE, Scope.OWN),
  COURSE_DELETE_OWN: buildPermissionName(ResourceType.COURSE, Action.DELETE, Scope.OWN),
  COURSE_MANAGE_OWN: buildPermissionName(ResourceType.COURSE, Action.MANAGE, Scope.OWN),

  // Organization permissions
  ORG_READ: buildPermissionName(ResourceType.ORGANIZATION, Action.READ, Scope.OWN),
  ORG_UPDATE: buildPermissionName(ResourceType.ORGANIZATION, Action.UPDATE, Scope.OWN),
  ORG_MANAGE: buildPermissionName(ResourceType.ORGANIZATION, Action.MANAGE, Scope.OWN),

  // User permissions
  USER_READ_OWN: buildPermissionName(ResourceType.USER, Action.READ, Scope.OWN),
  USER_UPDATE_OWN: buildPermissionName(ResourceType.USER, Action.UPDATE, Scope.OWN),
  USER_READ_ORG: buildPermissionName(ResourceType.USER, Action.READ, Scope.ORG),
  USER_INVITE: buildPermissionName(ResourceType.USER, Action.INVITE, Scope.ORG),

  // Role permissions
  ROLE_CREATE: buildPermissionName(ResourceType.ROLE, Action.CREATE, Scope.ORG),
  ROLE_READ: buildPermissionName(ResourceType.ROLE, Action.READ, Scope.ORG),
  ROLE_UPDATE: buildPermissionName(ResourceType.ROLE, Action.UPDATE, Scope.ORG),
  ROLE_DELETE: buildPermissionName(ResourceType.ROLE, Action.DELETE, Scope.ORG),

  // Analytics permissions
  ANALYTICS_READ_OWN: buildPermissionName(ResourceType.ANALYTICS, Action.READ, Scope.OWN),
  ANALYTICS_READ_ORG: buildPermissionName(ResourceType.ANALYTICS, Action.READ, Scope.ORG),
} as const

/**
 * Role slugs for common roles.
 */
export const RoleSlugs = {
  SUPER_ADMIN: 'super-admin',
  ORG_ADMIN: 'org-admin',
  MAINTAINER: 'maintainer',
  INSTRUCTOR: 'instructor',
  MODERATOR: 'moderator',
  USER: 'user',
} as const

export type RoleSlug = (typeof RoleSlugs)[keyof typeof RoleSlugs]

/**
 * Check if a role is an admin role.
 */
export function isAdminRole(roleSlug: string): boolean {
  return roleSlug === RoleSlugs.SUPER_ADMIN || roleSlug === RoleSlugs.ORG_ADMIN
}

/**
 * Check if a role has instructor-level access.
 */
export function isInstructorOrHigher(roleSlug: string): boolean {
  const instructorOrHigher = [
    RoleSlugs.SUPER_ADMIN,
    RoleSlugs.ORG_ADMIN,
    RoleSlugs.MAINTAINER,
    RoleSlugs.INSTRUCTOR,
  ]
  return instructorOrHigher.includes(roleSlug as RoleSlug)
}
