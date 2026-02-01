import { RoleSlugs, CommonPermissions } from '@/types/permissions';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { auth } from '@/auth';

interface AdminLayoutProps {
  children: ReactNode;
  params: Promise<{ orgslug: string }>;
}

/**
 * Server-side authorization for admin routes.
 * Ensures only users with admin/maintainer roles can access admin dashboard.
 */
async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { orgslug } = await params;
  const session = await auth();

  // Require authentication
  if (!session?.user) {
    redirect(`/orgs/${orgslug}/auth`);
  }

  // Check if user has admin or maintainer role
  const userRoles = session.roles || [];
  const now = new Date();

  const hasAdminRole = userRoles.some((userRole: any) => {
    // Filter expired roles
    if (userRole.expires_at) {
      const expiryDate = new Date(userRole.expires_at);
      if (expiryDate <= now) return false;
    }

    const roleSlug = userRole.role?.slug || '';
    return [RoleSlugs.SUPER_ADMIN, RoleSlugs.ORG_ADMIN, RoleSlugs.MAINTAINER].includes(roleSlug);
  });

  // Check permissions dictionary as fallback
  const permissions = session.permissions || {};
  const hasOrgPermission =
    permissions[CommonPermissions.ORG_MANAGE] === true ||
    permissions[CommonPermissions.ORG_UPDATE] === true ||
    permissions[CommonPermissions.ROLE_UPDATE] === true;

  if (!hasAdminRole && !hasOrgPermission) {
    redirect(`/orgs/${orgslug}/unauthorized`);
  }

  return <>{children}</>;
}

export default AdminLayout;
