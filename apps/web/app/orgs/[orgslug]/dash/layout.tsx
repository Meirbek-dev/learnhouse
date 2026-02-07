import { requireAuth } from '@/lib/server-auth';
import ClientAdminLayout from './ClientAdminLayout';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('DashPage');

  return {
    title: t('DashboardTitle'),
  };
}

async function DashboardLayout(props: { children: ReactNode; params: Promise<any> }) {
  const params = await props.params;
  const { children } = props;
  const { orgslug } = params;

  // Only require authentication here — child layouts enforce specific permissions
  await requireAuth(orgslug);

  return <ClientAdminLayout params={params}>{children}</ClientAdminLayout>;
}

export default DashboardLayout;
