import TeacherOverview from '@components/Dashboard/Analytics/TeacherOverview';
import AnalyticsEmptyState from '@components/Dashboard/Analytics/AnalyticsEmptyState';
import { getTeacherAssessmentList, getTeacherCourseList, getTeacherOverview, normalizeAnalyticsQuery } from '@services/analytics/teacher';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { getUserGroups } from '@services/usergroups/usergroups';
import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';

export default async function AnalyticsOverviewPage(props: {
  params: Promise<{ orgslug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgslug } = await props.params;
  const org = await getOrganizationContextInfo(orgslug);
  const session = await auth();
  const accessToken = session?.tokens?.access_token;
  const query = normalizeAnalyticsQuery(await props.searchParams);
  const analyticsEnabled = org?.config?.config?.features?.analytics?.enabled ?? true;
  const t = await getTranslations('TeacherAnalytics');

  if (!analyticsEnabled || !accessToken) {
    return <AnalyticsEmptyState title={t('pages.overviewDisabledTitle')} description={t('pages.overviewDisabledDesc')} />;
  }

  try {
    const [overview, courseRows, assessmentRows, usergroups] = await Promise.all([
      getTeacherOverview(org.id ?? org.org_id, accessToken, query),
      getTeacherCourseList(org.id ?? org.org_id, accessToken, query),
      getTeacherAssessmentList(org.id ?? org.org_id, accessToken, query),
      getUserGroups(org.id ?? org.org_id, accessToken),
    ]);

    const courseOptions = courseRows.items.map((course) => ({ label: course.course_name, value: String(course.course_id) }));
    const cohortOptions = Array.isArray(usergroups.data)
      ? usergroups.data.map((group: { id: number; name: string }) => ({ label: group.name, value: String(group.id) }))
      : [];

    return (
      <TeacherOverview
        orgslug={orgslug}
        orgId={org.id ?? org.org_id}
        query={query}
        data={overview}
        courseRows={courseRows.items}
        assessmentRows={assessmentRows.items}
        courseOptions={courseOptions}
        cohortOptions={cohortOptions}
      />
    );
  } catch (error) {
    return <AnalyticsEmptyState title={t('pages.overviewDisabledTitle')} description={error instanceof Error ? error.message : t('pages.overviewLoadError')} />;
  }
}
