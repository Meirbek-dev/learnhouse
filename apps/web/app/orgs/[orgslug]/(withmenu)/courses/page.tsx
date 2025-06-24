import type { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { getTranslations } from 'next-intl/server';

import { getOrgCourses } from '@services/courses/courses';
import { getOrgThumbnailMediaDirectory } from '@services/media/media';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { nextAuthOptions } from 'app/auth/options';

import Courses from './courses';

interface MetadataProps {
  params: Promise<{ orgslug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations('General');

  const org = await getOrganizationContextInfo(params.orgslug, {
    revalidate: 0,
    tags: ['organizations'],
  });

  // SEO
  return {
    title: `${t('courses')} — ${org.name}`,
    description: org.description,
    keywords: `${org.name}, ${org.description}, ${t('courses')}, ${t('learning')}, ${t('education')}, ${t('onlineLearning')}, ${t('edu')}, ${t('onlineCourses')}, ${org.name} ${t('courses')}`,
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
      title: `${t('courses')} — ${org.name}`,
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

const CoursesPage = async (params: any) => {
  const { orgslug } = await params.params;
  const org = await getOrganizationContextInfo(orgslug, {
    revalidate: 1800,
    tags: ['organizations'],
  });
  const session = await getServerSession(nextAuthOptions);
  const access_token = session?.tokens?.access_token;

  const courses = await getOrgCourses(orgslug, { revalidate: 0, tags: ['courses'] }, access_token || null);

  return (
    <div>
      <Courses
        org_id={org.org_id}
        orgslug={orgslug}
        courses={courses}
      />
    </div>
  );
};

export default CoursesPage;
