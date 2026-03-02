import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { getEditableOrgCourses } from '@services/courses/courses';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { auth } from '@/auth';

import CoursesHome from './client';

interface MetadataProps {
  params: Promise<{ orgslug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const t = await getTranslations('General');
  const params = await props.params;
  const org = await getOrganizationContextInfo(params.orgslug);

  // SEO
  return {
    title: `${t('courses')} - Ashyq Bilim`,
    description: org.description,
    keywords: `${org.name}, ${org.description}, ${t('courses')}, learning, education, online learning, edu, online courses, ${org.name} ${t('courses')}`,
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
      title: `${t('courses')} - Ashyq Bilim`,
      description: org.description,
      type: 'website',
    },
  };
}

const COURSES_PER_PAGE = 999;

async function CoursesPage(props: {
  params: Promise<{ orgslug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgslug } = await props.params;

  const org = await getOrganizationContextInfo(orgslug);
  const session = await auth();
  const access_token = session?.tokens?.access_token;
  const { courses, total } = await getEditableOrgCourses(orgslug, access_token || undefined, 1, COURSES_PER_PAGE);

  return (
    <CoursesHome
      org_id={org.org_id}
      orgslug={orgslug}
      courses={courses}
      totalCourses={total}
    />
  );
}

export default CoursesPage;
