import { fetchUserPermissions } from '@/services/permissions/permissions';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { auth } from '@/auth';

interface OrgLayoutProps {
  children: ReactNode;
  params: Promise<{ orgslug: string }>;
}

/**
 * Server-side authorization for organization settings.
 * Redirects unauthorized users immediately without client-side flash.
 */
async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { orgslug } = await params;
  const session = await auth();

  if (!session?.tokens?.access_token) {
    redirect(`/auth/login?orgslug=${orgslug}`);
  }

  try {
    const permissions = await fetchUserPermissions(session.tokens.access_token);

    // Check if user has organization management rights
    const canManageOrganization =
      permissions?.permissions?.['organizations:read'] === true ||
      permissions?.permissions?.['organizations:update'] === true;

    if (!canManageOrganization) {
      redirect(`/orgs/${orgslug}/dash`);
    }
  } catch {
    // On permission fetch failure, redirect to dashboard
    redirect(`/orgs/${orgslug}/dash`);
  }

  return <>{children}</>;
}

export default OrgLayout;
