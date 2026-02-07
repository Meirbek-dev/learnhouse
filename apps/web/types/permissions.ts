/**
 * Permission types — single source of truth for the frontend RBAC system.
 *
 * Constants use lowercase values to match the backend format directly.
 * No toLowerCase() conversion needed at check time.
 *
 * Based on shared/permissions.yaml
 */

// ============================================================================
// Constants
// ============================================================================

export const Actions = {
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
} as const;

export type Action = (typeof Actions)[keyof typeof Actions];

export const Resources = {
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
} as const;

export type Resource = (typeof Resources)[keyof typeof Resources];

export const Scopes = {
  ALL: 'all',
  OWN: 'own',
  ASSIGNED: 'assigned',
  ORG: 'org',
} as const;

export type Scope = (typeof Scopes)[keyof typeof Scopes];

export const RoleSlugs = {
  SUPER_ADMIN: 'super-admin',
  ORG_ADMIN: 'org-admin',
  MAINTAINER: 'maintainer',
  INSTRUCTOR: 'instructor',
  MODERATOR: 'moderator',
  USER: 'user',
} as const;

export type RoleSlug = (typeof RoleSlugs)[keyof typeof RoleSlugs];

// ============================================================================
// Types
// ============================================================================

/** Permission string format: "resource:action:scope" */
export type PermissionString = `${Resource}:${Action}:${Scope}`;

export interface Role {
  id: number;
  name: string;
  slug: string;
  description?: string;
  org_id?: number | null;
  is_system: boolean;
  priority: number;
}

/** Canonical type for user RBAC data from the API. */
export interface UserRBACData {
  roles: Role[];
  permissions: string[];
  org_id: number | null;
}

// ============================================================================
// Helpers
// ============================================================================

/** Build a permission string. Format: "resource:action:scope" */
export function perm(resource: Resource, action: Action, scope: Scope): PermissionString {
  return `${resource}:${action}:${scope}`;
}

/** @deprecated Use `perm()` instead. */
export function buildPermissionName(resource: string, action: string, scope: string = 'all'): string {
  return `${resource.toLowerCase()}:${action.toLowerCase()}:${scope.toLowerCase()}`;
}

export function isAdminRole(slug: string): boolean {
  return slug === RoleSlugs.SUPER_ADMIN || slug === RoleSlugs.ORG_ADMIN;
}
