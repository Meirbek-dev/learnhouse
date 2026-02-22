import RBACAdminClient from '@/app/orgs/[orgslug]/dash/admin/roles/client';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Components.OrgRoles');

  return {
    title: t('title'),
    description: t('cardDescription'),
  };
}

export default function RBACAdminPage() {
  return <RBACAdminClient />;
}
