import { getActivityWithAuthHeader } from '@services/courses/activities';
import { getCourseMetadata } from '@services/courses/courses';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';

import ActivityClient from './activity';

interface MetadataProps {
  params: Promise<{ orgslug: string; courseuuid: string; activityid: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

interface Session {
  tokens?: {
    access_token?: string;
  };
}

// Add this function at the top level to avoid duplicate fetches
async function fetchCourseMetadata(courseuuid: string, access_token: string | null | undefined) {
  return await getCourseMetadata(courseuuid, { revalidate: 60, tags: ['courses'] }, access_token || null);
}

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  preload: true,
  weight: ['100', '200', '300', '400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
});

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const { orgslug, courseuuid, activityid } = await props.params;
  const session = await auth();
  const access_token = session?.tokens?.access_token || null;
  const t = await getTranslations('General');

  // Get Org context information
  const _org = await getOrganizationContextInfo(orgslug, {
    revalidate: 1800,
    tags: ['organizations'],
  });
  const course_meta = await fetchCourseMetadata(courseuuid, access_token);
  const activity = await getActivityWithAuthHeader(
    activityid,
    { revalidate: 0, tags: ['activities'] },
    access_token || null,
  );

  // SEO
  return {
    title: `${activity.name} — ${course_meta.name} ${t('course')}`,
    description: course_meta.description,
    keywords: course_meta.learnings,
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
      title: `${activity.name} — ${course_meta.name} ${t('course')}`,
      description: course_meta.description,
      publishedTime: course_meta.creation_date,
      tags: course_meta.learnings,
    },
  };
}

const ActivityPage = async (params: any) => {
  // Destructure params directly
  const { orgslug, courseuuid, activityid } = await params.params;
  const session = await auth();
  const access_token = session?.tokens?.access_token || null;

  const [course_meta, activity] = await Promise.all([
    fetchCourseMetadata(courseuuid, access_token),
    getActivityWithAuthHeader(activityid, { revalidate: 0, tags: ['activities'] }, access_token || null),
  ]);

  return (
    <div className={jetbrainsMono.variable}>
      <ActivityClient
        activityid={activityid}
        courseuuid={courseuuid}
        orgslug={orgslug}
        activity={activity}
        course={course_meta}
      />
    </div>
  );
};

export default ActivityPage;
