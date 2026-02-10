import { Actions, Resources, Scopes } from '@/types/permissions';
import { requireAnyPermission } from '@/lib/server-auth';
import type { ReactNode } from 'react';

interface AdminLayoutProps {
  children: ReactNode;
  params: Promise<{ orgslug: string }>;
}

/**
 * Server-side authorization for admin routes.
 */
async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { orgslug } = await params;

  await requireAnyPermission(orgslug, [
    { action: Actions.MANAGE, resource: Resources.ORGANIZATION, scope: Scopes.OWN },
    { action: Actions.UPDATE, resource: Resources.ORGANIZATION, scope: Scopes.OWN },
    { action: Actions.MANAGE, resource: Resources.ORGANIZATION, scope: Scopes.ORG },
    { action: Actions.UPDATE, resource: Resources.ORGANIZATION, scope: Scopes.ORG },
    { action: Actions.UPDATE, resource: Resources.ROLE, scope: Scopes.ORG },
  ]);

  return <>{children}</>;
}

export default AdminLayout;
