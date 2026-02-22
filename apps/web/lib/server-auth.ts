import type { Action, Resource, Scope } from '@/types/permissions';
import { perm } from '@/types/permissions';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

/**
 * Resolve the numeric org ID from the session's roles by matching the orgslug.
 * Returns undefined if no matching org is found in the user's roles.
 */
function resolveOrgId(
  session: { roles?: { org: { id: number; slug: string } }[] },
  orgslug: string,
): number | undefined {
  const role = session.roles?.find((r) => r.org.slug === orgslug);
  return role?.org.id;
}

/**
 * Get the current session or redirect to login.
 */
export async function requireAuth(orgslug: string) {
  const session = await auth();
  if (!session?.user) {
    redirect(`/orgs/${orgslug}/auth`);
  }
  return session;
}

/**
 * Check if the session has a specific permission.
 */
export function sessionCan(
  session: { permissions?: string[] } | undefined,
  resource: Resource,
  action: Action,
  scope: Scope,
  permsSet?: Set<string>,
): boolean {
  const perms = permsSet ?? new Set(session?.permissions);
  return perms.has(perm(resource, action, scope));
}

/**
 * Require a specific permission or redirect.
 * Verifies that session permissions are scoped to the correct org.
 */
export async function requirePermission(
  orgslug: string,
  action: Action,
  resource: Resource,
  scope: Scope,
  redirectTo?: string,
) {
  const session = await requireAuth(orgslug);
  const currentOrgId = resolveOrgId(session, orgslug);

  // If we can resolve the org and permissions were loaded for another org, they're stale - deny access.
  if (currentOrgId && session.permissions_org_id !== currentOrgId) {
    redirect(redirectTo ?? `/orgs/${orgslug}/unauthorized`);
  }

  // If we cannot resolve org membership for this orgslug but the session is scoped to another org,
  // deny access to avoid carrying over stale permissions from a previous org context.
  if (!currentOrgId && session.permissions_org_id) {
    redirect(redirectTo ?? `/orgs/${orgslug}/unauthorized`);
  }

  const perms = new Set(session.permissions);
  if (!sessionCan(session, resource, action, scope, perms)) {
    redirect(redirectTo ?? `/orgs/${orgslug}/unauthorized`);
  }
  return session;
}

/**
 * Require any of the specified permissions or redirect.
 * Verifies that session permissions are scoped to the correct org.
 */
export async function requireAnyPermission(
  orgslug: string,
  checks: { action: Action; resource: Resource; scope: Scope }[],
  redirectTo?: string,
) {
  const session = await requireAuth(orgslug);
  const currentOrgId = resolveOrgId(session, orgslug);

  // If we can resolve the org and permissions were loaded for another org, they're stale - deny access.
  if (currentOrgId && session.permissions_org_id !== currentOrgId) {
    redirect(redirectTo ?? `/orgs/${orgslug}/unauthorized`);
  }

  // If we cannot resolve org membership for this orgslug but the session is scoped to another org,
  // deny access to avoid carrying over stale permissions from a previous org context.
  if (!currentOrgId && session.permissions_org_id) {
    redirect(redirectTo ?? `/orgs/${orgslug}/unauthorized`);
  }

  const perms = new Set(session.permissions);
  const hasAny = checks.some((c) => sessionCan(session, c.resource, c.action, c.scope, perms));
  if (!hasAny) {
    redirect(redirectTo ?? `/orgs/${orgslug}/unauthorized`);
  }
  return session;
}
