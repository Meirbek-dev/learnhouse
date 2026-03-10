import { getTeacherOverview, normalizeAnalyticsQuery } from '@services/analytics/teacher';
import AnalyticsEmptyState from '@components/Dashboard/Analytics/AnalyticsEmptyState';
import TeacherOverview from '@components/Dashboard/Analytics/TeacherOverview';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { getTranslations } from 'next-intl/server';
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
  const t = await getTranslations('TeacherAnalytics');

  if (!analyticsEnabled || !accessToken) {
    return (
      <AnalyticsEmptyState
        title={t('pages.overviewDisabledTitle')}
        description={t('pages.overviewDisabledDesc')}
      />
    );
  }

  try {
    const overview = await getTeacherOverview(org.id ?? org.org_id, accessToken, query);

    return (
      <TeacherOverview
        orgslug={orgslug}
        orgId={org.id ?? org.org_id}
        query={query}
        data={overview}
      />
    );
  } catch (error) {
    return (
      <AnalyticsEmptyState
        title={t('pages.overviewDisabledTitle')}
        description={error instanceof Error ? error.message : t('pages.overviewLoadError')}
      />
    );
  }
}
