import type { Action, Resource, Scope } from '@/types/permissions';
import { PLATFORM_ORG_SLUG } from '@/services/config/config';
import { perm } from '@/types/permissions';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';

function assertPlatformRoute(orgslug: string): void {
  if (orgslug !== PLATFORM_ORG_SLUG) {
    notFound();
  }
}

/**
 * Get the current session or redirect to login.
 */
export async function requireAuth(orgslug: string) {
  assertPlatformRoute(orgslug);
  const session = await auth();
  if (!session?.user) {
    redirect('/auth');
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
  if (!session.permissions_org_id) {
    redirect(redirectTo ?? '/unauthorized');
  }

  const perms = new Set(session.permissions);
  if (!sessionCan(session, resource, action, scope, perms)) {
    redirect(redirectTo ?? '/unauthorized');
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
  if (!session.permissions_org_id) {
    redirect(redirectTo ?? '/unauthorized');
  }

  const perms = new Set(session.permissions);
  const hasAny = checks.some((c) => sessionCan(session, c.resource, c.action, c.scope, perms));
  if (!hasAny) {
    redirect(redirectTo ?? '/unauthorized');
  }
  return session;
}
