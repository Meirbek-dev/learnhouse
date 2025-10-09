import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { auth } from '@/auth';

import Trail from './trail';

interface MetadataProps {
  params: Promise<{ orgslug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const params = await props.params;
  const session = await auth();
  const access_token = session?.tokens?.access_token;
  const t = await getTranslations('TrailPage');

  const org = await getOrganizationContextInfo(
    params.orgslug,
    {
      revalidate: 1800,
      tags: ['organizations'],
    },
    access_token,
  );
  return {
    title: `${t('title')} — МООК`,
    description: t('metaDescription'),
  };
}

const TrailPage = async (params: any) => {
  const { orgslug } = await params.params;

  return (
    <div>
      <Trail orgslug={orgslug} />
    </div>
  );
};

export default TrailPage;
