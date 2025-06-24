import { getOrganizationContextInfo } from '@services/organizations/orgs';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import SignUpClient from './signup';
import { Suspense } from 'react';

interface MetadataProps {
  params: Promise<{ orgslug: string; courseid: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata(params: MetadataProps): Promise<Metadata> {
  const { orgslug } = await params.searchParams;
  const t = await getTranslations('Auth.Signup');
  const org = await getOrganizationContextInfo(orgslug, {
    revalidate: 0,
    tags: ['organizations'],
  });

  return {
    title: t('title', { orgName: org.name }),
  };
}

const SignUp = async (params: any) => {
  const { orgslug } = await params.searchParams;
  const org = await getOrganizationContextInfo(orgslug, {
    revalidate: 0,
    tags: ['organizations'],
  });

  return (
    <Suspense fallback={<PageLoading />}>
      <SignUpClient org={org} />
    </Suspense>
  );
};

export default SignUp;
