import { requireAnyPermission } from '@/lib/server-auth';
import { Actions, Resources, Scopes } from '@/types/permissions';
import type { ReactNode } from 'react';

interface OrgLayoutProps {
  children: ReactNode;
  params: Promise<{ orgslug: string }>;
}

/**
 * Server-side authorization for organization settings.
 */
async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { orgslug } = await params;

  await requireAnyPermission(
    orgslug,
    [
      { action: Actions.READ, resource: Resources.ORGANIZATION, scope: Scopes.OWN },
      { action: Actions.UPDATE, resource: Resources.ORGANIZATION, scope: Scopes.OWN },
    ],
    `/orgs/${orgslug}/dash`,
  );

  return <>{children}</>;
}

export default OrgLayout;
