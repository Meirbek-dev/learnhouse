import { requireAnyPermission } from '@/lib/server-auth';
import { Actions, Resources, Scopes } from '@/types/permissions';
import type { ReactNode } from 'react';

interface PaymentsLayoutProps {
  children: ReactNode;
  params: Promise<{ orgslug: string }>;
}

/**
 * Server-side authorization for payment management routes.
 */
async function PaymentsLayout({ children, params }: PaymentsLayoutProps) {
  const { orgslug } = await params;

  await requireAnyPermission(orgslug, [
    { action: Actions.MANAGE, resource: Resources.PAYMENT, scope: Scopes.ORG },
    { action: Actions.MANAGE, resource: Resources.ORGANIZATION, scope: Scopes.OWN },
  ]);

  return <>{children}</>;
}

export default PaymentsLayout;
