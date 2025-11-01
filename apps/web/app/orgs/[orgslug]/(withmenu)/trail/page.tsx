import { getServerGamificationDashboard, getServerOrganizationLeaderboard } from '@/services/gamification/server';
import { GamificationProvider } from '@/components/Contexts/GamificationContext';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { auth } from '@/auth';

import Trail from './trail';

interface MetadataProps {
  params: Promise<{ orgslug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const params = await props.params;
  const session = await auth();
  const access_token = session?.tokens?.access_token;
  const t = await getTranslations('TrailPage');

  const org = await getOrganizationContextInfo(
    params.orgslug,
    {
      revalidate: 1800,
      tags: ['organizations'],
    },
    access_token,
  );
  return {
    title: `${t('title')} — Ashyq Bilim`,
    description: t('metaDescription'),
  };
}

const TrailPage = async (params: any) => {
  const { orgslug } = await params.params;
  const session = await auth();
  const accessToken = session?.tokens?.access_token;

  const org = await getOrganizationContextInfo(
    orgslug,
    {
      revalidate: 1800,
      tags: ['organizations'],
    },
    accessToken,
  );

  const orgId = Number(org?.org_id ?? org?.id ?? 0);
  const content = (
    <div>
      <Trail orgslug={orgslug} />
    </div>
  );

  if (!orgId) {
    return content;
  }

  const [dashboardData, leaderboardData] = await Promise.all([
    getServerGamificationDashboard(orgId, {
      revalidate: 30,
      tags: [`gamification:dashboard:${orgId}`],
    }),
    getServerOrganizationLeaderboard(orgId, 10, {
      revalidate: 60,
      tags: [`gamification:leaderboard:${orgId}`],
    }),
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
