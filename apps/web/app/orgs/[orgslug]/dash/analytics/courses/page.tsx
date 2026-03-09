import AnalyticsEmptyState from '@components/Dashboard/Analytics/AnalyticsEmptyState';
import CourseHealthTable from '@components/Dashboard/Analytics/CourseHealthTable';
import TeacherFilterBar from '@components/Dashboard/Analytics/TeacherFilterBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getTeacherCourseList, normalizeAnalyticsQuery } from '@services/analytics/teacher';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { getUserGroups } from '@services/usergroups/usergroups';
import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';

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
    const [courseList, usergroups] = await Promise.all([
      getTeacherCourseList(org.id ?? org.org_id, accessToken, query),
      getUserGroups(org.id ?? org.org_id, accessToken),
    ]);
    const courseOptions = courseList.items.map((course) => ({ label: course.course_name, value: String(course.course_id) }));
    const cohortOptions = Array.isArray(usergroups.data)
      ? usergroups.data.map((group: { id: number; name: string }) => ({ label: group.name, value: String(group.id) }))
      : [];
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 xl:px-8">
        <Card className="border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>{t('pages.courseRankingTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">{t('pages.courseRankingDescription')}</CardContent>
        </Card>
        <TeacherFilterBar orgslug={orgslug} path={`/orgs/${orgslug}/dash/analytics/courses`} query={query} courseCount={courseList.items.length} courseOptions={courseOptions} cohortOptions={cohortOptions} />
        <CourseHealthTable orgslug={orgslug} rows={courseList.items} />
      </div>
    );
  } catch (error) {
    return <AnalyticsEmptyState title={t('pages.coursesUnavailableTitle')} description={error instanceof Error ? error.message : t('pages.coursesLoadError')} />;
  }
}
