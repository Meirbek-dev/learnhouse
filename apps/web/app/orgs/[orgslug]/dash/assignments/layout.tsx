import { Actions, Resources, Scopes } from '@/types/permissions';
import { requireAnyPermission } from '@/lib/server-auth';
import type { ReactNode } from 'react';

interface AssignmentsLayoutProps {
  children: ReactNode;
  params: Promise<{ orgslug: string }>;
}

/**
 * Server-side authorization for assignment management routes.
 */
async function AssignmentsLayout({ children, params }: AssignmentsLayoutProps) {
  const { orgslug } = await params;

  await requireAnyPermission(orgslug, [
    { action: Actions.CREATE, resource: Resources.COURSE, scope: Scopes.ORG },
    { action: Actions.UPDATE, resource: Resources.COURSE, scope: Scopes.ORG },
    { action: Actions.UPDATE, resource: Resources.COURSE, scope: Scopes.OWN },
    { action: Actions.GRADE, resource: Resources.ASSIGNMENT, scope: Scopes.ORG },
    { action: Actions.CREATE, resource: Resources.ASSIGNMENT, scope: Scopes.ORG },
  ]);

  return <>{children}</>;
}

export default AssignmentsLayout;
