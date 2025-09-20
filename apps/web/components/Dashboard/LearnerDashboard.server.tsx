// Server wrapper for LearnerDashboard — fetches data on the server using cache tags
import { getServerGamificationDashboard, getServerOrganizationLeaderboard } from '@/services/gamification/server';
import { LearnerDashboard as ClientLearnerDashboard } from './LearnerDashboard';

export default async function LearnerDashboardServer({
  orgId,
  orgSlug,
  courses = [],
  className = '',
  leaderboardLimit = 20,
}: {
  orgId: number;
  orgSlug: string;
  courses?: any[];
  className?: string;
  leaderboardLimit?: number;
}) {
  const dashboard = await getServerGamificationDashboard(orgId, {
    revalidate: 30,
    tags: [`gamification:dashboard:${orgId}`, `gamification:profile:${orgId}`],
  });
  const leaderboard = await getServerOrganizationLeaderboard(orgId, leaderboardLimit, {
    revalidate: 30,
    tags: [`gamification:leaderboard:${orgId}`],
  });

  return (
    <ClientLearnerDashboard
      orgId={orgId}
      orgSlug={orgSlug}
      courses={courses}
      className={className}
      serverDashboardData={dashboard}
      serverLeaderboardData={leaderboard}
    />
  );
}
