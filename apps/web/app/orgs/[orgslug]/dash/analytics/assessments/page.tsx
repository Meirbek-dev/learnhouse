import AnalyticsEmptyState from '@components/Dashboard/Analytics/AnalyticsEmptyState';
import AssessmentOutliersTable from '@components/Dashboard/Analytics/AssessmentOutliersTable';
import TeacherFilterBar from '@components/Dashboard/Analytics/TeacherFilterBar';
import { Button } from '@/components/ui/button';
import { getTeacherAssessmentList, normalizeAnalyticsQuery } from '@services/analytics/teacher';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function AnalyticsAssessmentsPage(props: {
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
    return <AnalyticsEmptyState title={t('pages.assessmentsUnavailableTitle')} description={t('pages.assessmentsUnavailableDesc')} />;
  }

  try {
    const assessments = await getTeacherAssessmentList(org.id ?? org.org_id, accessToken, query);
    const totalPages = Math.max(1, Math.ceil(assessments.total / assessments.page_size));
    const params = new URLSearchParams();
    if (query.window) params.set('window', query.window);
    if (query.compare) params.set('compare', query.compare);
    if (query.bucket) params.set('bucket', query.bucket);
    if (query.course_ids) params.set('course_ids', query.course_ids);
    if (query.cohort_ids) params.set('cohort_ids', query.cohort_ids);
    if (query.timezone) params.set('timezone', query.timezone);
    if (query.sort_by) params.set('sort_by', query.sort_by);
    if (query.sort_order) params.set('sort_order', query.sort_order);
    if (query.bucket_start) params.set('bucket_start', query.bucket_start);
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 xl:px-8">
        <TeacherFilterBar orgslug={orgslug} path={`/orgs/${orgslug}/dash/analytics/assessments`} query={query} courseCount={assessments.course_options.length} courseOptions={assessments.course_options} cohortOptions={assessments.cohort_options} />
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            {t('table.showingRows', {
              from: (assessments.page - 1) * assessments.page_size + 1,
              to: Math.min(assessments.page * assessments.page_size, assessments.total),
              total: assessments.total,
            })}
          </span>
        </div>
        <AssessmentOutliersTable orgslug={orgslug} rows={assessments.items} storageKey="assessments-page" serverPaginated={true} />
        {totalPages > 1 ? (
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" disabled={assessments.page <= 1} render={<Link href={`/orgs/${orgslug}/dash/analytics/assessments?${new URLSearchParams({ ...Object.fromEntries(params.entries()), page: String(Math.max(1, assessments.page - 1)), page_size: String(assessments.page_size) }).toString()}`} />}>Prev</Button>
            <span className="text-sm text-slate-600">Page {assessments.page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={assessments.page >= totalPages} render={<Link href={`/orgs/${orgslug}/dash/analytics/assessments?${new URLSearchParams({ ...Object.fromEntries(params.entries()), page: String(Math.min(totalPages, assessments.page + 1)), page_size: String(assessments.page_size) }).toString()}`} />}>Next</Button>
          </div>
        ) : null}
      </div>
    );
  } catch (error) {
    return <AnalyticsEmptyState title={t('pages.assessmentsUnavailableTitle')} description={error instanceof Error ? error.message : t('pages.assessmentsLoadError')} />;
  }
}
