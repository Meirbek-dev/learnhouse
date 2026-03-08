import TeacherOverview from '@components/Dashboard/Analytics/TeacherOverview';
import AnalyticsEmptyState from '@components/Dashboard/Analytics/AnalyticsEmptyState';
import { getTeacherAssessmentList, getTeacherCourseList, getTeacherOverview, normalizeAnalyticsQuery } from '@services/analytics/teacher';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { auth } from '@/auth';

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

  if (!analyticsEnabled || !accessToken) {
    return <AnalyticsEmptyState title="Analytics unavailable" description="This organization has analytics disabled or the current session cannot access analytics data." />;
  }

  try {
    const [overview, courseRows, assessmentRows] = await Promise.all([
      getTeacherOverview(org.id ?? org.org_id, accessToken, query),
      getTeacherCourseList(org.id ?? org.org_id, accessToken, query),
      getTeacherAssessmentList(org.id ?? org.org_id, accessToken, query),
    ]);

    return (
      <TeacherOverview
        orgslug={orgslug}
        orgId={org.id ?? org.org_id}
        query={query}
        data={overview}
        courseRows={courseRows.items}
        assessmentRows={assessmentRows.items}
      />
    );
  } catch (error) {
    return <AnalyticsEmptyState title="Analytics unavailable" description={error instanceof Error ? error.message : 'The analytics service could not be loaded.'} />;
  }
}
