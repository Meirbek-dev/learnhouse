import { Actions, Resources, Scopes } from '@/types/permissions';
import { requireAnyPermission } from '@/lib/server-auth';
import { PLATFORM_ORG_SLUG } from '@/services/config/config';
import type { ReactNode } from 'react';

export default async function PlatformUsersLayout({ children }: { children: ReactNode }) {
  await requireAnyPermission(PLATFORM_ORG_SLUG, [
    { action: Actions.UPDATE, resource: Resources.USER, scope: Scopes.ORG },
    { action: Actions.READ, resource: Resources.USER, scope: Scopes.ORG },
    { action: Actions.MANAGE, resource: Resources.USERGROUP, scope: Scopes.ORG },
  ]);

  return <>{children}</>;
}
