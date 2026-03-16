import { getServerGamificationDashboard, getServerOrganizationLeaderboard } from '@/services/gamification/server';
import { getPlatformOrganizationContextInfo } from '@services/organizations/orgs';
import { GamificationProvider } from '@/components/Contexts/GamificationContext';
import { getOptionalSession } from '@/lib/get-optional-session';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

import Trail from '@/app/_shared/withmenu/trail/trail';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('TrailPage');

  return {
    title: `${t('title')} - Ashyq Bilim`,
    description: t('metaDescription'),
  };
}

export default async function PlatformTrailPage() {
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
}
