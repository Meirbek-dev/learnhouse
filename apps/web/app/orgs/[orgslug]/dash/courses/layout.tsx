import { RoleSlugs, Actions, ResourceTypes, buildPermissionName, Scopes } from '@/types/permissions';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { auth } from '@/auth';

interface CoursesLayoutProps {
  children: ReactNode;
  params: Promise<{ orgslug: string }>;
}

/**
 * Server-side authorization for course management routes.
 * Ensures only users with course management permissions can access course admin features.
 */
async function CoursesLayout({ children, params }: CoursesLayoutProps) {
  const { orgslug } = await params;
  const session = await auth();

  // Require authentication
  if (!session?.user) {
    redirect(`/orgs/${orgslug}/auth`);
  }

  // Check if user has instructor-level role or higher (can create/manage courses)
  const userRoles = session.roles || [];
  const now = new Date();

  const hasInstructorRole = userRoles.some((userRole: any) => {
    // Filter expired roles
    if (userRole.expires_at) {
      const expiryDate = new Date(userRole.expires_at);
      if (expiryDate <= now) return false;
    }

    const roleSlug = userRole.role?.slug || '';
    return [
      RoleSlugs.SUPER_ADMIN,
      RoleSlugs.ORG_ADMIN,
      RoleSlugs.MAINTAINER,
      RoleSlugs.INSTRUCTOR,
    ].includes(roleSlug);
  });

  // Check permissions dictionary as fallback
  const permissions = session.permissions || {};
  const canManageCourses =
    permissions[buildPermissionName(ResourceTypes.COURSE, Actions.CREATE, Scopes.ORG)] === true ||
    permissions[buildPermissionName(ResourceTypes.COURSE, Actions.UPDATE, Scopes.ORG)] === true ||
    permissions[buildPermissionName(ResourceTypes.COURSE, Actions.MANAGE, Scopes.ORG)] === true;

  // Allow access if user has instructor-level role or specific course permissions
  if (!hasInstructorRole && !canManageCourses) {
    redirect(`/orgs/${orgslug}/unauthorized`);
  }

  return <>{children}</>;
}

export default CoursesLayout;
