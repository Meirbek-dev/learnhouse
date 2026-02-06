import { RoleSlugs, Actions, ResourceTypes, buildPermissionName, Scopes } from '@/types/permissions';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { auth } from '@/auth';

interface PaymentsLayoutProps {
  children: ReactNode;
  params: Promise<{ orgslug: string }>;
}

/**
 * Server-side authorization for payment management routes.
 * Ensures only users with payment management permissions can access payment admin features.
 */
async function PaymentsLayout({ children, params }: PaymentsLayoutProps) {
  const { orgslug } = await params;
  const session = await auth();

  // Require authentication
  if (!session?.user) {
    redirect(`/orgs/${orgslug}/auth`);
  }

  // Check if user has admin-level role (can manage payments)
  const userRoles = session.roles || [];

  const hasAdminRole = userRoles.some((userRole: any) => {
    const roleSlug = userRole.role?.slug || '';
    return [RoleSlugs.SUPER_ADMIN, RoleSlugs.ORG_ADMIN].includes(roleSlug);
  });

  // Check permissions dictionary as fallback
  const permissions = session.permissions || {};
  const canManagePayments =
    permissions[buildPermissionName(ResourceTypes.PAYMENT, Actions.MANAGE, Scopes.ORG)] === true ||
    permissions[buildPermissionName(ResourceTypes.ORGANIZATION, Actions.MANAGE, Scopes.OWN)] === true;

  // Allow access if user has admin role or specific payment management permissions
  if (!hasAdminRole && !canManagePayments) {
    redirect(`/orgs/${orgslug}/unauthorized`);
  }

  return <>{children}</>;
}

export default PaymentsLayout;
