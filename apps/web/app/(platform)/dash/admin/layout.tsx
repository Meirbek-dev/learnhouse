import { Actions, Resources, Scopes } from '@/types/permissions';
import { requireAnyPermission } from '@/lib/server-auth';
import { PLATFORM_ORG_SLUG } from '@/services/config/config';
import type { ReactNode } from 'react';

export default async function PlatformAdminLayout({ children }: { children: ReactNode }) {
  await requireAnyPermission(PLATFORM_ORG_SLUG, [
    { action: Actions.MANAGE, resource: Resources.ORGANIZATION, scope: Scopes.OWN },
    { action: Actions.UPDATE, resource: Resources.ORGANIZATION, scope: Scopes.OWN },
    { action: Actions.MANAGE, resource: Resources.ORGANIZATION, scope: Scopes.ORG },
    { action: Actions.UPDATE, resource: Resources.ORGANIZATION, scope: Scopes.ORG },
    { action: Actions.UPDATE, resource: Resources.ROLE, scope: Scopes.ORG },
    { action: Actions.READ, resource: Resources.ROLE, scope: Scopes.ORG },
  ]);

  return <>{children}</>;
}
