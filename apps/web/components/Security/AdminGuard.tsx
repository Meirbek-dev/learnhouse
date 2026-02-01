'use client';

import { usePermissions } from '@/hooks/usePermissions';
import { Actions, ResourceTypes } from '@/types/permissions';
import { useOrg } from '@/components/Contexts/OrgContext';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Spinner } from '@/components/ui/spinner';

interface AdminGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
}

/**
 * AdminGuard - Client-side permission guard for admin routes.
 *
 * Checks if the user has organization management permissions.
 * If not, shows fallback or redirects.
 *
 * For server-side protection, use layout-level checks with server actions.
 */
export function AdminGuard({ children, fallback, redirectTo }: AdminGuardProps) {
  const { can, loading } = usePermissions();
  const org = useOrg() as any;
  const router = useRouter();

  const canManageOrg = can(Actions.MANAGE, ResourceTypes.ORGANIZATION);

  useEffect(() => {
    if (!loading && !canManageOrg && redirectTo) {
      router.push(redirectTo);
    }
  }, [loading, canManageOrg, redirectTo, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (!canManageOrg) {
    if (fallback !== undefined) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground text-center">
          <p className="text-lg font-semibold">Access Denied</p>
          <p className="mt-2">You don't have permission to access this area.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
