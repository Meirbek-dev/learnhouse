// Server wrapper for LearnerDashboard — fetches data on the server using cache tags
import { getServerGamificationDashboard, getServerOrganizationLeaderboard } from '@/services/gamification/server';
import { gamificationTag } from '@/lib/cacheTags';
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
    tags: [gamificationTag.dashboard(orgId), gamificationTag.profile(orgId)],
  });
  const leaderboard = await getServerOrganizationLeaderboard(orgId, leaderboardLimit, {
    revalidate: 30,
    tags: [gamificationTag.leaderboard(orgId)],
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
