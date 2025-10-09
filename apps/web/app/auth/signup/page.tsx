import { getOrganizationContextInfo } from '@services/organizations/orgs';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import SignUpClient from './signup';

interface MetadataProps {
  params: Promise<{ orgslug: string; courseid: number }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(params: MetadataProps): Promise<Metadata> {
  const { orgslug } = await params.searchParams;
  const t = await getTranslations('Auth.Signup');
  const org = await getOrganizationContextInfo(orgslug, {
    cache: 'no-store',
    tags: ['organizations'],
  });

  return {
    title: t('title', { orgName: "МООК" }),
  };
}

const SignUp = async (params: any) => {
  const { orgslug } = await params.searchParams;
  const org = await getOrganizationContextInfo(orgslug, {
    cache: 'no-store',
    tags: ['organizations'],
  });

  return (
    <Suspense fallback={<PageLoading />}>
      <SignUpClient org={org} />
    </Suspense>
  );
};

export default SignUp;
