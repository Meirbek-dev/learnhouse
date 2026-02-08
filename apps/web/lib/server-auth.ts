import type { Action, Resource, Scope } from '@/types/permissions';
import { perm } from '@/types/permissions';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

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
  action: Action,
  resource: Resource,
  scope: Scope,
  permsSet?: Set<string>,
): boolean {
  const perms = permsSet ?? new Set(session?.permissions);
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
  const perms = new Set(session.permissions);
  if (!sessionCan(session, action, resource, scope, perms)) {
    redirect(redirectTo ?? `/orgs/${orgslug}/unauthorized`);
  }
  return session;
}

/**
 * Require any of the specified permissions or redirect.
 */
export async function requireAnyPermission(
  orgslug: string,
  checks: { action: Action; resource: Resource; scope: Scope }[],
  redirectTo?: string,
) {
  const session = await requireAuth(orgslug);
  const perms = new Set(session.permissions);
  const hasAny = checks.some((c) => perms.has(perm(c.resource, c.action, c.scope)));
  if (!hasAny) {
    redirect(redirectTo ?? `/orgs/${orgslug}/unauthorized`);
  }
  return session;
}
