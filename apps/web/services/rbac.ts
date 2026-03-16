/**
 * Unified RBAC service - single file for all permission and role API calls.
 *
 * Every RBAC-related fetch in the frontend should go through this module.
 * No inline fetch() calls for roles/permissions anywhere else.
 */

import type {
  CreateRoleBody,
  OrgUserBasic,
  Permission,
  Role,
  RoleAuditListResponse,
  UpdateRoleBody,
  UserRBACData,
  UserRoleAssignment,
} from '@/types/permissions';
import { getAPIUrl } from '@/services/config/config';

// ============================================================================
// Internal helpers
// ============================================================================

const api = (path: string) => `${getAPIUrl()}${path}`;

async function request<T>(url: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `RBAC API error: ${res.status}`);
  }

  return res.json();
}

// ============================================================================
// My permissions
// ============================================================================

export function fetchMyPermissions(token: string, orgId?: number): Promise<UserRBACData> {
  const qs = orgId ? `?org_id=${orgId}` : '';
  return request(api(`rbac/me/permissions${qs}`), token);
}

// ============================================================================
// Permissions - read-only
// ============================================================================

export function listAllPermissions(token: string, orgId?: number): Promise<Permission[]> {
  const qs = orgId ? `?org_id=${orgId}` : '';
  return request(api(`roles/permissions/all${qs}`), token);
}

// ============================================================================
// Roles - CRUD
// ============================================================================

export function listRoles(token: string, orgId: number): Promise<Role[]> {
  return request(api(`roles?org_id=${orgId}`), token);
}

export function getRole(token: string, roleId: number): Promise<Role> {
  return request(api(`roles/${roleId}`), token);
}

export function getRolePermissions(token: string, roleId: number, orgId?: number): Promise<Permission[]> {
  const qs = orgId ? `?org_id=${orgId}` : '';
  return request(api(`roles/${roleId}/permissions${qs}`), token);
}

export function createRole(token: string, orgId: number, body: CreateRoleBody): Promise<Role> {
  return request(api('roles'), token, {
    method: 'POST',
    body: JSON.stringify({ ...body, org_id: orgId }),
  });
}

export function updateRole(token: string, roleId: number, body: UpdateRoleBody): Promise<Role> {
  return request(api(`roles/${roleId}`), token, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function deleteRole(token: string, roleId: number): Promise<void> {
  return request(api(`roles/${roleId}`), token, { method: 'DELETE' });
}

export function getRoleUsersCount(token: string, roleId: number, orgId?: number): Promise<{ count: number }> {
  const qs = orgId ? `?org_id=${orgId}` : '';
  return request(api(`roles/${roleId}/users/count${qs}`), token);
}

export function listRoleAuditLog(
  token: string,
  orgId: number,
  page = 1,
  pageSize = 20,
): Promise<RoleAuditListResponse> {
  return request(api(`roles/audit-log?org_id=${orgId}&page=${page}&page_size=${pageSize}`), token);
}

// ============================================================================
// Role ↔ Permission assignment
// ============================================================================

export function addPermissionToRole(token: string, roleId: number, permissionId: number): Promise<void> {
  return request(api(`roles/${roleId}/permissions`), token, {
    method: 'POST',
    body: JSON.stringify({ permission_id: permissionId }),
  });
}

export function removePermissionFromRole(token: string, roleId: number, permissionId: number): Promise<void> {
  return request(api(`roles/${roleId}/permissions/${permissionId}`), token, {
    method: 'DELETE',
  });
}

// ============================================================================
// User ↔ Role assignment
// ============================================================================

export function listUserRoles(token: string, orgId: number): Promise<UserRoleAssignment[]> {
  void orgId;
  return request<UserRoleAssignment[]>(api('rbac/user-roles'), token);
}

export function assignRoleToUser(token: string, userId: number, roleId: number, orgId: number): Promise<void> {
  return request(api('rbac/roles/assign'), token, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, role_id: roleId, org_id: orgId }),
  });
}

export function removeRoleFromUser(token: string, userId: number, roleId: number, orgId: number): Promise<void> {
  return request(api('rbac/roles/revoke'), token, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, role_id: roleId, org_id: orgId }),
  });
}

// ============================================================================
// Org users (used by role assignment UI)
// ============================================================================

export function listOrgUsers(token: string, orgId: number, limit = 100): Promise<OrgUserBasic[]> {
  void orgId;
  // The endpoint may return { users: [...] } or a flat array.
  return request<OrgUserBasic[] | { users: OrgUserBasic[] }>(api(`orgs/users?limit=${limit}`), token).then(
    (data) => (Array.isArray(data) ? data : data.users),
  );
}
