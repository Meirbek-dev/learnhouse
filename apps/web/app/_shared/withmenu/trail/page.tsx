import { getServerGamificationDashboard, getServerOrganizationLeaderboard } from '@/services/gamification/server';
import { getPlatformOrganizationContextInfo } from '@services/organizations/orgs';
import { GamificationProvider } from '@/components/Contexts/GamificationContext';
import { getOptionalSession } from '@/lib/get-optional-session';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

import Trail from './trail';

interface MetadataProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const t = await getTranslations('TrailPage');

  return {
    title: `${t('title')} - Ashyq Bilim`,
    description: t('metaDescription'),
  };
}

const TrailPage = async () => {
  const session = await getOptionalSession();
  const accessToken = session?.tokens?.access_token;

  const org = await getPlatformOrganizationContextInfo(accessToken || undefined);

  const orgId = Number(org?.org_id ?? org?.id ?? 0);
  const content = (
    <div>
      <Trail />
    </div>
  );

  if (!orgId) {
    return content;
  }

  const [dashboardData, leaderboardData] = await Promise.all([
    getServerGamificationDashboard(orgId),
    getServerOrganizationLeaderboard(orgId, 10),
  ]);

  if (!dashboardData) {
    return content;
  }

  return (
    <GamificationProvider
      orgId={orgId}
      initialData={{
        profile: dashboardData.profile,
        dashboard: dashboardData,
        leaderboard: leaderboardData ?? null,
      }}
    >
      {content}
    </GamificationProvider>
  );
};

export default TrailPage;
