import AnalyticsEmptyState from '@components/Dashboard/Analytics/AnalyticsEmptyState';
import CourseHealthTable from '@components/Dashboard/Analytics/CourseHealthTable';
import TeacherFilterBar from '@components/Dashboard/Analytics/TeacherFilterBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getTeacherCourseList, normalizeAnalyticsQuery } from '@services/analytics/teacher';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function AnalyticsCoursesPage(props: {
  params: Promise<{ orgslug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgslug } = await props.params;
  const org = await getOrganizationContextInfo(orgslug);
  const session = await auth();
  const accessToken = session?.tokens?.access_token;
  const query = normalizeAnalyticsQuery(await props.searchParams);
  const t = await getTranslations('TeacherAnalytics');

  if (!accessToken) {
    return <AnalyticsEmptyState title={t('pages.coursesUnavailableTitle')} description={t('pages.coursesUnavailableDesc')} />;
  }

  try {
    const courseList = await getTeacherCourseList(org.id ?? org.org_id, accessToken, query);
    const totalPages = Math.max(1, Math.ceil(courseList.total / courseList.page_size));
    const params = new URLSearchParams();
    if (query.window) params.set('window', query.window);
    if (query.compare) params.set('compare', query.compare);
    if (query.bucket) params.set('bucket', query.bucket);
    if (query.course_ids) params.set('course_ids', query.course_ids);
    if (query.cohort_ids) params.set('cohort_ids', query.cohort_ids);
    if (query.timezone) params.set('timezone', query.timezone);
    if (query.sort_by) params.set('sort_by', query.sort_by);
    if (query.sort_order) params.set('sort_order', query.sort_order);
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 xl:px-8">
        <Card className="border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>{t('pages.courseRankingTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">{t('pages.courseRankingDescription')}</CardContent>
        </Card>
        <TeacherFilterBar orgslug={orgslug} path={`/orgs/${orgslug}/dash/analytics/courses`} query={query} courseCount={courseList.total} courseOptions={courseList.course_options} cohortOptions={courseList.cohort_options} />
        <CourseHealthTable orgslug={orgslug} rows={courseList.items} storageKey="courses-page" />
        {totalPages > 1 ? (
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" disabled={courseList.page <= 1} render={<Link href={`/orgs/${orgslug}/dash/analytics/courses?${new URLSearchParams({ ...Object.fromEntries(params.entries()), page: String(Math.max(1, courseList.page - 1)), page_size: String(courseList.page_size) }).toString()}`} />}>Prev</Button>
            <span className="text-sm text-slate-600">Page {courseList.page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={courseList.page >= totalPages} render={<Link href={`/orgs/${orgslug}/dash/analytics/courses?${new URLSearchParams({ ...Object.fromEntries(params.entries()), page: String(Math.min(totalPages, courseList.page + 1)), page_size: String(courseList.page_size) }).toString()}`} />}>Next</Button>
          </div>
        ) : null}
      </div>
    );
  } catch (error) {
    return <AnalyticsEmptyState title={t('pages.coursesUnavailableTitle')} description={error instanceof Error ? error.message : t('pages.coursesLoadError')} />;
  }
}
