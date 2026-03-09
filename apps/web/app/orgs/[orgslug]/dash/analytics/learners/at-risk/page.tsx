import AnalyticsEmptyState from '@components/Dashboard/Analytics/AnalyticsEmptyState';
import AtRiskLearnersTable from '@components/Dashboard/Analytics/AtRiskLearnersTable';
import TeacherFilterBar from '@components/Dashboard/Analytics/TeacherFilterBar';
import { Button } from '@/components/ui/button';
import { getAtRiskLearners, normalizeAnalyticsQuery } from '@services/analytics/teacher';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

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
    const risk = await getAtRiskLearners(org.id ?? org.org_id, accessToken, query);
    const totalPages = Math.max(1, Math.ceil(risk.total / risk.page_size));
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
        <TeacherFilterBar orgslug={orgslug} path={`/orgs/${orgslug}/dash/analytics/learners/at-risk`} query={query} courseCount={risk.course_options.length} courseOptions={risk.course_options} cohortOptions={risk.cohort_options} />
        <AtRiskLearnersTable rows={risk.items} title={t('pages.atRiskPageTitle')} description={t('pages.atRiskPageDescription', { total: risk.total })} storageKey="at-risk-page" />
        {totalPages > 1 ? (
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" disabled={risk.page <= 1} render={<Link href={`/orgs/${orgslug}/dash/analytics/learners/at-risk?${new URLSearchParams({ ...Object.fromEntries(params.entries()), page: String(Math.max(1, risk.page - 1)), page_size: String(risk.page_size) }).toString()}`} />}>Prev</Button>
            <span className="text-sm text-slate-600">Page {risk.page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={risk.page >= totalPages} render={<Link href={`/orgs/${orgslug}/dash/analytics/learners/at-risk?${new URLSearchParams({ ...Object.fromEntries(params.entries()), page: String(Math.min(totalPages, risk.page + 1)), page_size: String(risk.page_size) }).toString()}`} />}>Next</Button>
          </div>
        ) : null}
      </div>
    );
  } catch (error) {
    return <AnalyticsEmptyState title={t('pages.atRiskUnavailableTitle')} description={error instanceof Error ? error.message : t('pages.atRiskLoadError')} />;
  }
}
