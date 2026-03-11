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

const COURSES_PER_PAGE = 24;

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseQuery(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? '';
}

function parseSort(value: string | string[] | undefined): 'updated' | 'name' {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'name' ? 'name' : 'updated';
}

async function CoursesPage(props: {
  params: Promise<{ orgslug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgslug } = await props.params;
  const searchParams = await props.searchParams;
  const currentPage = parsePage(searchParams.page);
  const query = parseQuery(searchParams.q);
  const sortBy = parseSort(searchParams.sort);

  const session = await auth();
  const access_token = session?.tokens?.access_token;
  const { courses, total } = await getEditableOrgCourses(
    orgslug,
    access_token || undefined,
    currentPage,
    COURSES_PER_PAGE,
    query,
    sortBy,
  );

  return (
    <CoursesHome
      orgslug={orgslug}
      courses={courses}
      totalCourses={total}
      currentPage={currentPage}
      searchQuery={query}
      sortBy={sortBy}
      pageSize={COURSES_PER_PAGE}
    />
  );
}

export default CoursesPage;
