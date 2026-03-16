import { getTranslations } from 'next-intl/server';
import { requireAuth } from '@/lib/server-auth';
import { PLATFORM_ORG_SLUG } from '@/services/config/config';
import type { Metadata } from 'next';

import ClientAdminLayout from './client-admin-layout';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('DashPage');

  return {
    title: t('DashboardTitle'),
  };
}

export default async function PlatformDashLayout({ children }: { children: React.ReactNode }) {
  await requireAuth(PLATFORM_ORG_SLUG);

  return <ClientAdminLayout>{children}</ClientAdminLayout>;
}
