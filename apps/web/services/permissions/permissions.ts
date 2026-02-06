/**
 * Permission service for interacting with the RBAC API.
 *
 * All endpoints are under /api/v1/rbac/ and /api/v1/roles/
 */

import type { Role } from '@/types/permissions';
import { getAPIUrl } from '@services/config/config';

// ============================================================================
// Types
// ============================================================================

interface PermissionCheckRequest {
  action: string;
  resource: string;
  resource_id?: string;
  org_id?: number;
}

interface PermissionCheckResponse {
  granted: boolean;
  permission: string;
}

interface BatchPermissionCheckResponse {
  results: Record<string, boolean>;
}

interface UserPermissionsResponse {
  roles: Array<Record<string, any>>;
  permissions: string[];
  org_id: number | null;
}

// ============================================================================
// Permission checks
// ============================================================================

/**
 * Fetch the current user's effective permissions.
 */
export async function fetchUserPermissions(
  accessToken: string,
  orgId?: number,
): Promise<UserPermissionsResponse> {
  const url = new URL(`${getAPIUrl()}rbac/me/permissions`);
  if (orgId) {
    url.searchParams.set('org_id', orgId.toString());
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
 * Batch check multiple permissions (returns map of permission → granted).
 */
export async function batchCheckPermissions(
  accessToken: string,
  checks: PermissionCheckRequest[],
  orgId?: number,
): Promise<BatchPermissionCheckResponse> {
  const response = await fetch(`${getAPIUrl()}rbac/check/batch`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ checks, org_id: orgId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to check permissions: ${response.status}`);
  }

  return response.json();
}

/**
 * Check a single permission.
 */
export async function checkPermission(
  accessToken: string,
  action: string,
  resource: string,
  orgId?: number,
): Promise<boolean> {
  const response = await fetch(`${getAPIUrl()}rbac/check`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ action, resource, org_id: orgId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to check permission: ${response.status}`);
  }

  const result: PermissionCheckResponse = await response.json();
  return result.granted;
}

// ============================================================================
// Role management
// ============================================================================

/**
 * List all roles (system + org-specific).
 */
export async function listRoles(
  accessToken: string,
  orgId?: number,
): Promise<Role[]> {
  const url = new URL(`${getAPIUrl()}roles/`);
  if (orgId !== undefined) {
    url.searchParams.set('org_id', orgId.toString());
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
 * Get a single role by ID.
 */
export async function getRoleById(
  accessToken: string,
  roleId: number,
): Promise<Role> {
  const response = await fetch(`${getAPIUrl()}roles/${roleId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
 */
export async function assignRoleToUser(
  accessToken: string,
  userId: number,
  roleSlug: string,
  orgId: number,
): Promise<void> {
  const response = await fetch(`${getAPIUrl()}rbac/roles/assign`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      user_id: userId,
      role_slug: roleSlug,
      org_id: orgId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to assign role: ${response.status}`);
  }
}

/**
 * Remove a role from a user.
 */
export async function removeRoleFromUser(
  accessToken: string,
  userId: number,
  roleSlug: string,
  orgId: number,
): Promise<void> {
  const response = await fetch(`${getAPIUrl()}rbac/roles/revoke`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      user_id: userId,
      role_slug: roleSlug,
      org_id: orgId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to remove role: ${response.status}`);
  }
}
