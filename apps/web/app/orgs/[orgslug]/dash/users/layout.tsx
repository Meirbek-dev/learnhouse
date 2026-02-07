import { Actions, Resources, Scopes } from '@/types/permissions';
import { requireAnyPermission } from '@/lib/server-auth';
import type { ReactNode } from 'react';

interface UsersLayoutProps {
  children: ReactNode;
  params: Promise<{ orgslug: string }>;
}

/**
 * Server-side authorization for user management routes.
 */
async function UsersLayout({ children, params }: UsersLayoutProps) {
  const { orgslug } = await params;

  await requireAnyPermission(orgslug, [
    { action: Actions.INVITE, resource: Resources.USER, scope: Scopes.ORG },
    { action: Actions.UPDATE, resource: Resources.USER, scope: Scopes.ORG },
    { action: Actions.READ, resource: Resources.USER, scope: Scopes.ORG },
    { action: Actions.UPDATE, resource: Resources.ROLE, scope: Scopes.ORG },
    { action: Actions.MANAGE, resource: Resources.USERGROUP, scope: Scopes.ORG },
  ]);

  return <>{children}</>;
}

export default UsersLayout;
