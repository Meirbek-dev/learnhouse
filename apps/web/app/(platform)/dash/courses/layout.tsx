import { Actions, Resources, Scopes } from '@/types/permissions';
import { requireAnyPermission } from '@/lib/server-auth';
import { PLATFORM_ORG_SLUG } from '@/services/config/config';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import type { ReactNode } from 'react';

export default async function PlatformCoursesLayout({ children }: { children: ReactNode }) {
  await requireAnyPermission(PLATFORM_ORG_SLUG, [
    { action: Actions.CREATE, resource: Resources.COURSE, scope: Scopes.ORG },
    { action: Actions.UPDATE, resource: Resources.COURSE, scope: Scopes.ORG },
    { action: Actions.UPDATE, resource: Resources.COURSE, scope: Scopes.OWN },
    { action: Actions.MANAGE, resource: Resources.COURSE, scope: Scopes.ORG },
    { action: Actions.MANAGE, resource: Resources.COURSE, scope: Scopes.OWN },
  ]);

  return <NuqsAdapter>{children}</NuqsAdapter>;
}
