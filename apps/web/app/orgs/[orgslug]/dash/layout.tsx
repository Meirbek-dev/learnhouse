import { Actions, Resources, Scopes } from '@/types/permissions';
import { requirePermission } from '@/lib/server-auth';
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

  await requirePermission(orgslug, Actions.MANAGE, Resources.ORGANIZATION, Scopes.OWN);

  return <ClientAdminLayout params={params}>{children}</ClientAdminLayout>;
}

export default DashboardLayout;
