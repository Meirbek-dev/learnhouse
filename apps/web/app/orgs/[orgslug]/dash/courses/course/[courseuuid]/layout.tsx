import { Actions, Resources, Scopes } from '@/types/permissions';
import { requireAnyPermission } from '@/lib/server-auth';
import type { ReactNode } from 'react';

interface CourseEditorLayoutProps {
  children: ReactNode;
  params: Promise<{ orgslug: string; courseuuid: string }>;
}

async function CourseEditorLayout({ children, params }: CourseEditorLayoutProps) {
  const { orgslug } = await params;

  await requireAnyPermission(orgslug, [
    { action: Actions.UPDATE, resource: Resources.COURSE, scope: Scopes.ORG },
    { action: Actions.UPDATE, resource: Resources.COURSE, scope: Scopes.OWN },
    { action: Actions.MANAGE, resource: Resources.COURSE, scope: Scopes.ORG },
    { action: Actions.MANAGE, resource: Resources.COURSE, scope: Scopes.OWN },
    { action: Actions.CREATE, resource: Resources.CERTIFICATE, scope: Scopes.ORG },
  ]);

  return <>{children}</>;
}

export default CourseEditorLayout;
