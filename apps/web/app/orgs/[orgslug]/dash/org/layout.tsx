'use client';

import PageLoading from '@components/Objects/Loaders/PageLoading';
import useAdminStatus from '@components/Hooks/useAdminStatus';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

interface OrgLayoutProps {
  children: ReactNode;
}

const OrgLayout = ({ children }: OrgLayoutProps) => {
  const { rights, loading } = useAdminStatus();
  const router = useRouter();
  const t = useTranslations('Security');

  // Check if user has organization management rights
  const canManageOrganization =
    rights?.organizations?.action_read === true || rights?.organizations?.action_update === true;

  useEffect(() => {
    if (loading) return;

    if (!canManageOrganization) {
      // Redirect to dashboard if user doesn't have permission
      router.push('/dash');
    }
  }, [loading, canManageOrganization, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <PageLoading />
      </div>
    );
  }

  if (!canManageOrganization) {
    return (
      <div className="flex h-screen items-center justify-center">
        <h1 className="text-2xl">{t('unauthorizedAccessMessage')}</h1>
      </div>
    );
  }

  return <>{children}</>;
};

export default OrgLayout;
