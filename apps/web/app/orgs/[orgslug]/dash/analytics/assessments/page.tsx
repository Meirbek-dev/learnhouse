import AnalyticsEmptyState from '@components/Dashboard/Analytics/AnalyticsEmptyState';
import AssessmentOutliersTable from '@components/Dashboard/Analytics/AssessmentOutliersTable';
import TeacherFilterBar from '@components/Dashboard/Analytics/TeacherFilterBar';
import { getTeacherAssessmentList, getTeacherCourseList, normalizeAnalyticsQuery } from '@services/analytics/teacher';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { getUserGroups } from '@services/usergroups/usergroups';
import { auth } from '@/auth';

export default async function AnalyticsAssessmentsPage(props: {
  params: Promise<{ orgslug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgslug } = await props.params;
  const org = await getOrganizationContextInfo(orgslug);
  const session = await auth();
  const accessToken = session?.tokens?.access_token;
  const query = normalizeAnalyticsQuery(await props.searchParams);

  if (!accessToken) {
    return <AnalyticsEmptyState title="Assessment analytics unavailable" description="An authenticated session is required to inspect assessment analytics." />;
  }

  try {
    const [assessments, courses, usergroups] = await Promise.all([
      getTeacherAssessmentList(org.id ?? org.org_id, accessToken, query),
      getTeacherCourseList(org.id ?? org.org_id, accessToken, query),
      getUserGroups(org.id ?? org.org_id, accessToken),
    ]);
    const courseOptions = courses.items.map((course) => ({ label: course.course_name, value: String(course.course_id) }));
    const cohortOptions = Array.isArray(usergroups.data)
      ? usergroups.data.map((group: { id: number; name: string }) => ({ label: group.name, value: String(group.id) }))
      : [];
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 xl:px-8">
        <TeacherFilterBar orgslug={orgslug} path={`/orgs/${orgslug}/dash/analytics/assessments`} query={query} courseCount={courses.items.length} courseOptions={courseOptions} cohortOptions={cohortOptions} />
        <AssessmentOutliersTable orgslug={orgslug} rows={assessments.items} />
      </div>
    );
  } catch (error) {
    return <AnalyticsEmptyState title="Assessment analytics unavailable" description={error instanceof Error ? error.message : 'The assessment analytics view could not be loaded.'} />;
  }
}
