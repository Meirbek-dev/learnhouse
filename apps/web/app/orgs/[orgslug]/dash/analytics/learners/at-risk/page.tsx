import AnalyticsEmptyState from '@components/Dashboard/Analytics/AnalyticsEmptyState';
import AtRiskLearnersTable from '@components/Dashboard/Analytics/AtRiskLearnersTable';
import TeacherFilterBar from '@components/Dashboard/Analytics/TeacherFilterBar';
import { getAtRiskLearners, getTeacherCourseList, normalizeAnalyticsQuery } from '@services/analytics/teacher';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { auth } from '@/auth';

export default async function AnalyticsAtRiskPage(props: {
  params: Promise<{ orgslug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgslug } = await props.params;
  const org = await getOrganizationContextInfo(orgslug);
  const session = await auth();
  const accessToken = session?.tokens?.access_token;
  const query = normalizeAnalyticsQuery(await props.searchParams);

  if (!accessToken) {
    return <AnalyticsEmptyState title="Learner risk unavailable" description="An authenticated session is required to inspect at-risk learners." />;
  }

  try {
    const [risk, courses] = await Promise.all([
      getAtRiskLearners(org.id ?? org.org_id, accessToken, query),
      getTeacherCourseList(org.id ?? org.org_id, accessToken, query),
    ]);
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 xl:px-8">
        <TeacherFilterBar orgslug={orgslug} query={query} courseCount={courses.items.length} />
        <AtRiskLearnersTable rows={risk.items} title="Full at-risk learner list" description={`Showing ${risk.total} scoped learners ranked by risk score.`} />
      </div>
    );
  } catch (error) {
    return <AnalyticsEmptyState title="Learner risk unavailable" description={error instanceof Error ? error.message : 'The learner risk view could not be loaded.'} />;
  }
}
