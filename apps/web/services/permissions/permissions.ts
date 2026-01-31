/**
 * Permission service for interacting with the RBAC API.
 *
 * This service provides methods for:
 * - Fetching user permissions
 * - Checking permissions
 * - Managing roles (admin only)
 */

import type { Action, Permission, ResourceType, Role } from '@/types/permissions';
import { getAPIUrl } from '@services/config/config';

interface PermissionCheckRequest {
  action: Action;
  resource: ResourceType;
  resource_id?: string;
  org_id?: number;
}

interface PermissionCheckResult {
  action: Action;
  resource: ResourceType;
  resource_id?: string | null;
  org_id?: number | null;
  allowed: boolean;
}

interface BatchPermissionCheckResponse {
  results: PermissionCheckResult[];
  permissions: Record<string, boolean>;
}

interface UserPermissionsResponse {
  user_id: number;
  org_id: number | null;
  roles: Role[];
  permissions: Record<string, boolean>;
  resource_permissions: {
    resource_type: string;
    resource_id: string;
    permission_id: number;
  }[];
}

/**
 * Fetch the current user's effective permissions.
 *
 * @param accessToken - JWT access token
 * @param orgId - Optional organization ID to filter permissions
 * @returns Promise<UserPermissionsResponse>
 */
export async function fetchUserPermissions(accessToken: string, orgId?: number): Promise<UserPermissionsResponse> {
  const url = new URL(`${getAPIUrl()}me/permissions`);
  if (orgId) {
    url.searchParams.set('org_id', orgId.toString());
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch permissions: ${response.status}`);
  }

  return response.json();
}

/**
 * Batch check multiple permissions.
 *
 * This is more efficient than individual permission checks
 * when you need to verify multiple permissions at once.
 *
 * @param accessToken - JWT access token
 * @param checks - Array of permission checks to perform
 * @returns Promise<BatchPermissionCheckResponse>
 */
export async function batchCheckPermissions(
  accessToken: string,
  checks: PermissionCheckRequest[],
): Promise<BatchPermissionCheckResponse> {
  const response = await fetch(`${getAPIUrl()}permissions/check`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ checks }),
  });

  if (!response.ok) {
    throw new Error(`Failed to check permissions: ${response.status}`);
  }

  return response.json();
}

/**
 * Check a single permission.
 *
 * For checking multiple permissions, use batchCheckPermissions instead.
 *
 * @param accessToken - JWT access token
 * @param action - Action to check
 * @param resource - Resource type
 * @param resourceId - Optional specific resource ID
 * @param orgId - Optional organization context
 * @returns Promise<boolean>
 */
export async function checkPermission(
  accessToken: string,
  action: Action,
  resource: ResourceType,
  resourceId?: string,
  orgId?: number,
): Promise<boolean> {
  const url = new URL(`${getAPIUrl()}permissions/check`);
  url.searchParams.set('action', action);
  url.searchParams.set('resource', resource);
  if (resourceId) url.searchParams.set('resource_id', resourceId);
  if (orgId) url.searchParams.set('org_id', orgId.toString());

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to check permission: ${response.status}`);
  }

  const result: PermissionCheckResult = await response.json();
  return result.allowed;
}

/**
 * List all available permissions.
 *
 * @param accessToken - JWT access token
 * @param resourceType - Optional filter by resource type
 * @returns Promise<Permission[]>
 */
export async function listPermissions(accessToken: string, resourceType?: string): Promise<Permission[]> {
  const url = new URL(`${getAPIUrl()}permissions`);
  if (resourceType) {
    url.searchParams.set('resource_type', resourceType);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to list permissions: ${response.status}`);
  }

  return response.json();
}

/**
 * List all roles in the new system.
 *
 * @param accessToken - JWT access token
 * @param orgId - Optional organization ID filter
 * @param includeGlobal - Whether to include global roles (default: true)
 * @returns Promise<Role[]>
 */
export async function listRoles(accessToken: string, orgId?: number, includeGlobal = true): Promise<Role[]> {
  const url = new URL(`${getAPIUrl()}roles`);
  if (orgId !== undefined) {
    url.searchParams.set('org_id', orgId.toString());
  }
  url.searchParams.set('include_global', includeGlobal.toString());

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to list roles: ${response.status}`);
  }

  return response.json();
}

/**
 * Get a role with all its permissions.
 *
 * @param accessToken - JWT access token
 * @param roleId - Role ID
 * @returns Promise<Role & { permissions: Permission[] }>
 */
export async function getRoleWithPermissions(
  accessToken: string,
  roleId: number,
): Promise<Role & { permissions: Permission[] }> {
  const response = await fetch(`${getAPIUrl()}roles/${roleId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to get role: ${response.status}`);
  }

  return response.json();
}

/**
 * Assign a role to a user.
 *
 * @param accessToken - JWT access token
 * @param userId - User ID
 * @param roleId - Role ID
 * @param orgId - Organization ID
 * @param expiresAt - Optional expiry date
 * @returns Promise<void>
 */
export async function assignRoleToUser(
  accessToken: string,
  userId: number,
  roleId: number,
  orgId: number,
  expiresAt?: Date,
): Promise<void> {
  const response = await fetch(`${getAPIUrl()}users/${userId}/roles`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      role_id: roleId,
      org_id: orgId,
      expires_at: expiresAt?.toISOString() || null,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to assign role: ${response.status}`);
  }
}

/**
 * Remove a role from a user.
 *
 * @param accessToken - JWT access token
 * @param userId - User ID
 * @param roleId - Role ID
 * @param orgId - Organization ID
 * @returns Promise<void>
 */
export async function removeRoleFromUser(
  accessToken: string,
  userId: number,
  roleId: number,
  orgId: number,
): Promise<void> {
  const url = new URL(`${getAPIUrl()}users/${userId}/roles/${roleId}`);
  url.searchParams.set('org_id', orgId.toString());

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to remove role: ${response.status}`);
  }
}
