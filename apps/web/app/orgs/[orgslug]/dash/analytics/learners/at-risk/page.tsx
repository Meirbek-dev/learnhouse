import AnalyticsEmptyState from '@components/Dashboard/Analytics/AnalyticsEmptyState';
import AtRiskLearnersTable from '@components/Dashboard/Analytics/AtRiskLearnersTable';
import TeacherFilterBar from '@components/Dashboard/Analytics/TeacherFilterBar';
import { getAtRiskLearners, getTeacherCourseList, normalizeAnalyticsQuery } from '@services/analytics/teacher';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { getUserGroups } from '@services/usergroups/usergroups';
import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';

export default async function AnalyticsAtRiskPage(props: {
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
    return <AnalyticsEmptyState title={t('pages.atRiskUnavailableTitle')} description={t('pages.atRiskUnavailableDesc')} />;
  }

  try {
    const [risk, courses, usergroups] = await Promise.all([
      getAtRiskLearners(org.id ?? org.org_id, accessToken, query),
      getTeacherCourseList(org.id ?? org.org_id, accessToken, query),
      getUserGroups(org.id ?? org.org_id, accessToken),
    ]);
    const courseOptions = courses.items.map((course) => ({ label: course.course_name, value: String(course.course_id) }));
    const cohortOptions = Array.isArray(usergroups.data)
      ? usergroups.data.map((group: { id: number; name: string }) => ({ label: group.name, value: String(group.id) }))
      : [];
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 xl:px-8">
        <TeacherFilterBar orgslug={orgslug} path={`/orgs/${orgslug}/dash/analytics/learners/at-risk`} query={query} courseCount={courses.items.length} courseOptions={courseOptions} cohortOptions={cohortOptions} />
        <AtRiskLearnersTable rows={risk.items} title={t('pages.atRiskPageTitle')} description={t('pages.atRiskPageDescription', { total: risk.total })} />
      </div>
    );
  } catch (error) {
    return <AnalyticsEmptyState title={t('pages.atRiskUnavailableTitle')} description={error instanceof Error ? error.message : t('pages.atRiskLoadError')} />;
  }
}
