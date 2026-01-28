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
    return ['super-admin', 'org-admin', 'maintainer'].includes(roleSlug);
  });

  // Check permissions dictionary as fallback
  const permissions = session.permissions || {};
  const hasOrgPermission =
    permissions['organization:manage:own'] === true ||
    permissions['organization:update:own'] === true ||
    permissions['role:update:org'] === true;

  if (!hasAdminRole && !hasOrgPermission) {
    redirect(`/orgs/${orgslug}/unauthorized`);
  }

  return <>{children}</>;
}

export default AdminLayout;
