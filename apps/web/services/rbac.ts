/**
 * Unified RBAC service — single file for all permission and role API calls.
 */

import type { Role, UserRBACData } from '@/types/permissions';
import { getAPIUrl } from '@/services/config/config';

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
// Permissions
// ============================================================================

export const fetchMyPermissions = (token: string, orgId?: number) =>
  request<UserRBACData>(api(`rbac/me/permissions${orgId ? `?org_id=${orgId}` : ''}`), token);

// ============================================================================
// Roles — CRUD
// ============================================================================

export const listRoles = (token: string, orgId?: number) =>
  request<Role[]>(api(`roles/${orgId !== undefined ? `?org_id=${orgId}` : ''}`), token);

export const getRole = (token: string, roleId: number) => request<Role>(api(`roles/${roleId}`), token);

export const createRole = (token: string, orgId: number, body: Record<string, unknown>) =>
  request<Role>(api(`roles/org/${orgId}`), token, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const updateRole = (token: string, roleId: number, body: Record<string, unknown>) =>
  request<Role>(api(`roles/${roleId}`), token, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

export const deleteRole = (token: string, roleId: number, orgId: number) =>
  request<void>(api(`roles/${roleId}?org_id=${orgId}`), token, { method: 'DELETE' });

// ============================================================================
// Role Assignment
// ============================================================================

export const assignRole = (token: string, userId: number, roleSlug: string, orgId: number) =>
  request<void>(api('rbac/roles/assign'), token, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, role_slug: roleSlug, org_id: orgId }),
  });

export const revokeRole = (token: string, userId: number, roleSlug: string, orgId: number) =>
  request<void>(api('rbac/roles/revoke'), token, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, role_slug: roleSlug, org_id: orgId }),
  });
