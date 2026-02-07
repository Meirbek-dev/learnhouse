import { requireAnyPermission } from '@/lib/server-auth';
import { Actions, Resources, Scopes } from '@/types/permissions';
import type { ReactNode } from 'react';

interface CoursesLayoutProps {
  children: ReactNode;
  params: Promise<{ orgslug: string }>;
}

/**
 * Server-side authorization for course management routes.
 */
async function CoursesLayout({ children, params }: CoursesLayoutProps) {
  const { orgslug } = await params;

  await requireAnyPermission(orgslug, [
    { action: Actions.CREATE, resource: Resources.COURSE, scope: Scopes.ORG },
    { action: Actions.UPDATE, resource: Resources.COURSE, scope: Scopes.ORG },
    { action: Actions.MANAGE, resource: Resources.COURSE, scope: Scopes.ORG },
  ]);

  return <>{children}</>;
}

export default CoursesLayout;
