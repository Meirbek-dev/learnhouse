import { getTeacherOverview, normalizeAnalyticsQuery } from '@services/analytics/teacher';
import AnalyticsEmptyState from '@components/Dashboard/Analytics/AnalyticsEmptyState';
import TeacherOverview from '@components/Dashboard/Analytics/TeacherOverview';
import { getPlatformOrganizationContextInfo } from '@services/organizations/orgs';
import { PLATFORM_ORG_SLUG } from '@/services/config/config';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';

export default function PlatformAnalyticsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PlatformAnalyticsPageInner searchParams={props.searchParams} />;
}

async function PlatformAnalyticsPageInner(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const org = await getPlatformOrganizationContextInfo();
  const session = await auth();
  const accessToken = session?.tokens?.access_token;
  const query = normalizeAnalyticsQuery(await props.searchParams);
  const analyticsEnabled = org?.config?.config?.features?.analytics?.enabled ?? true;
  const t = await getTranslations('TeacherAnalytics');

  if (!analyticsEnabled || !accessToken) {
    return <AnalyticsEmptyState title={t('pages.overviewDisabledTitle')} description={t('pages.overviewDisabledDesc')} />;
  }

  try {
    const overview = await getTeacherOverview(accessToken, query);

    return <TeacherOverview orgslug={PLATFORM_ORG_SLUG} orgId={org.id ?? org.org_id} query={query} data={overview} />;
  } catch (error) {
    return (
      <AnalyticsEmptyState
        title={t('pages.overviewDisabledTitle')}
        description={error instanceof Error ? error.message : t('pages.overviewLoadError')}
      />
    );
  }
}
