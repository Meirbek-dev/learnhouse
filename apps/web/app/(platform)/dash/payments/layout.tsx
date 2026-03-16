import { Actions, Resources, Scopes } from '@/types/permissions';
import { requireAnyPermission } from '@/lib/server-auth';
import { PLATFORM_ORG_SLUG } from '@/services/config/config';
import type { ReactNode } from 'react';

export default async function PlatformPaymentsLayout({ children }: { children: ReactNode }) {
  await requireAnyPermission(PLATFORM_ORG_SLUG, [
    { action: Actions.MANAGE, resource: Resources.PAYMENT, scope: Scopes.ORG },
    { action: Actions.MANAGE, resource: Resources.ORGANIZATION, scope: Scopes.OWN },
  ]);

  return <>{children}</>;
}
