import { getCourseReadinessSummary, courseNeedsAttention } from '@/lib/course-management';
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

function parsePreset(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const valid = ['all', 'drafts', 'published', 'private', 'recent', 'attention'];
  return valid.includes(raw ?? '') ? (raw!) : 'all';
}

function isCourseRecent(dateString?: string) {
  if (!dateString) return false;
  const updatedAt = new Date(dateString).getTime();
  if (Number.isNaN(updatedAt)) return false;
  return Date.now() - updatedAt <= 1000 * 60 * 60 * 24 * 14;
}

/**
 * Filter courses on the server before passing to the client component.
 * This avoids client-side filtering on paginated data, eliminating the flash
 * of unfiltered content and ensuring summary card counts are correct.
 */
function filterCourses(courses: any[], preset: string): any[] {
  if (preset === 'all') return courses;
  return courses.filter((course) => {
    const ready = getCourseReadinessSummary(course, null).readyToPublish;
    switch (preset) {
      case 'drafts': {
        return !course.public || !ready;
      }
      case 'published': {
        return Boolean(course.public);
      }
      case 'private': {
        return !course.public;
      }
      case 'recent': {
        return isCourseRecent(course.update_date);
      }
      case 'attention': {
        return courseNeedsAttention(course) || !ready;
      }
      default: {
        return true;
      }
    }
  });
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
  const preset = parsePreset(searchParams.preset);

  const session = await auth();
  const access_token = session?.tokens?.access_token;
  const [org, { courses: allCourses, total }] = await Promise.all([
    getOrganizationContextInfo(orgslug, null, access_token || undefined),
    getEditableOrgCourses(orgslug, access_token || undefined, currentPage, COURSES_PER_PAGE, query, sortBy),
  ]);

  // Server-side preset filtering — eliminates client-side filter flash.
  const courses = filterCourses(allCourses, preset);

  return (
    <CoursesHome
      orgslug={orgslug}
      courses={courses}
      org_id={org.id}
      totalCourses={total}
      currentPage={currentPage}
      searchQuery={query}
      sortBy={sortBy}
      pageSize={COURSES_PER_PAGE}
      preset={preset}
    />
  );
}

export default CoursesPage;
