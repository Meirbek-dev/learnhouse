import { RoleSlugs, Actions, ResourceTypes, buildPermissionName, Scopes } from '@/types/permissions';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { auth } from '@/auth';

interface UsersLayoutProps {
  children: ReactNode;
  params: Promise<{ orgslug: string }>;
}

/**
 * Server-side authorization for user management routes.
 * Ensures only users with user management permissions can access user admin features.
 */
async function UsersLayout({ children, params }: UsersLayoutProps) {
  const { orgslug } = await params;
  const session = await auth();

  // Require authentication
  if (!session?.user) {
    redirect(`/orgs/${orgslug}/auth`);
  }

  // Check if user has admin-level role (can manage users)
  const userRoles = session.roles || [];
  const now = new Date();

  const hasAdminRole = userRoles.some((userRole: any) => {
    // Filter expired roles
    if (userRole.expires_at) {
      const expiryDate = new Date(userRole.expires_at);
      if (expiryDate <= now) return false;
    }

    const roleSlug = userRole.role?.slug || '';
    return [RoleSlugs.SUPER_ADMIN, RoleSlugs.ORG_ADMIN].includes(roleSlug);
  });

  // Check permissions dictionary as fallback
  const permissions = session.permissions || {};
  const canManageUsers =
    permissions[buildPermissionName(ResourceTypes.USER, Actions.INVITE, Scopes.ORG)] === true ||
    permissions[buildPermissionName(ResourceTypes.USER, Actions.UPDATE, Scopes.ORG)] === true ||
    permissions[buildPermissionName(ResourceTypes.USER, Actions.READ, Scopes.ORG)] === true ||
    permissions[buildPermissionName(ResourceTypes.ROLE, Actions.UPDATE, Scopes.ORG)] === true ||
    permissions[buildPermissionName(ResourceTypes.USERGROUP, Actions.MANAGE, Scopes.ORG)] === true;

  // Allow access if user has admin role or specific user management permissions
  if (!hasAdminRole && !canManageUsers) {
    redirect(`/orgs/${orgslug}/unauthorized`);
  }

  return <>{children}</>;
}

export default UsersLayout;
