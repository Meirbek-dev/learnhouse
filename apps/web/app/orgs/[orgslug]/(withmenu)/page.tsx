export const dynamic = 'force-dynamic';

import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { getOrgThumbnailMediaDirectory } from '@services/media/media';
import { getOrgCollections } from '@services/courses/collections';
import LandingClassic from '@components/Landings/LandingClassic';
import LandingCustom from '@components/Landings/LandingCustom';
import { getOrgCourses } from '@services/courses/courses';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { auth } from '@/auth';

interface MetadataProps {
  params: Promise<{ orgslug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const params = await props.params;
  // Get Org context information
  const org = await getOrganizationContextInfo(params.orgslug, {
    revalidate: 0,
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
  const session = await auth();
  const access_token = session?.tokens?.access_token;
  const courses = await getOrgCourses(orgslug, { revalidate: 0, tags: ['courses'] }, access_token || null);
  const org = await getOrganizationContextInfo(orgslug, {
    revalidate: 0,
    tags: ['organizations'],
  });
  const org_id = org.id;
  const collections = await getOrgCollections(org.id, access_token, {
    revalidate: 0,
    tags: ['courses'],
  });

  // Check if custom landing is enabled
  const hasCustomLanding = org.config?.config?.landing?.enabled;

  return (
    <div className="w-full">
      {hasCustomLanding ? (
        <LandingCustom
          landing={org.config.config.landing}
          orgslug={orgslug}
        />
      ) : (
        <LandingClassic
          courses={courses}
          collections={collections}
          orgslug={orgslug}
          org_id={org_id}
        />
      )}
    </div>
  );
};

export default OrgHomePage;
