import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import type { Action, Resource, Scope } from '@/types/permissions';
import { perm } from '@/types/permissions';

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
  session: { permissions?: string[] },
  action: Action,
  resource: Resource,
  scope: Scope,
): boolean {
  const perms = new Set(session.permissions ?? []);
  return perms.has(perm(resource, action, scope));
}

/**
 * Require a specific permission or redirect.
 */
export async function requirePermission(
  orgslug: string,
  action: Action,
  resource: Resource,
  scope: Scope,
  redirectTo?: string,
) {
  const session = await requireAuth(orgslug);
  if (!sessionCan(session, action, resource, scope)) {
    redirect(redirectTo ?? `/orgs/${orgslug}/unauthorized`);
  }
  return session;
}

/**
 * Require any of the specified permissions or redirect.
 */
export async function requireAnyPermission(
  orgslug: string,
  checks: Array<{ action: Action; resource: Resource; scope: Scope }>,
  redirectTo?: string,
) {
  const session = await requireAuth(orgslug);
  const hasAny = checks.some((c) => sessionCan(session, c.action, c.resource, c.scope));
  if (!hasAny) {
    redirect(redirectTo ?? `/orgs/${orgslug}/unauthorized`);
  }
  return session;
}
