export const dynamic = 'force-dynamic';

import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { getOrgThumbnailMediaDirectory } from '@services/media/media';
import { PageSuspense } from '@components/Utils/PageSuspense';
import { getTranslations } from 'next-intl/server';
import { LandingContent } from './LandingContent';
import type { Metadata } from 'next';

interface MetadataProps {
  params: Promise<{ orgslug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const params = await props.params;
  // Get Org context information
  const org = await getOrganizationContextInfo(params.orgslug, {
    cache: 'no-store',
    tags: ['organizations'],
  });
  const t = await getTranslations('General');

  // SEO
  return {
    title: `${t('home')} — ${org.name}`,
    description: org.description,
    robots: {
      index: true,
      follow: true,
      nocache: true,
      googleBot: {
        'index': true,
        'follow': true,
        'max-image-preview': 'large',
      },
    },
    openGraph: {
      title: `${t('home')} — ${org.name}`,
      description: org.description,
      type: 'website',
      images: [
        {
          url: getOrgThumbnailMediaDirectory(org?.org_uuid, org?.thumbnail_image),
          width: 800,
          height: 600,
          alt: org.name,
        },
      ],
    },
  };
}

const OrgHomePage = async (params: any) => {
  const { orgslug } = await params.params;

  return (
    <div className="w-full">
      <PageSuspense>
        <LandingContent orgslug={orgslug} />
      </PageSuspense>
    </div>
  );
};

export default OrgHomePage;
