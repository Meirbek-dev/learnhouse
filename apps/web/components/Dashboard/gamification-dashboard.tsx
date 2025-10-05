import { auth } from '@/auth';
import { GamificationProvider } from '@/components/Contexts/GamificationContext';
import { Skeleton } from '@/components/ui/skeleton';
import { getServerGamificationDashboard, getServerOrganizationLeaderboard } from '@/services/gamification/server';
import { LeaderboardCard } from './Gamification/leaderboard-card';
import { ProfileCard } from './Gamification/profile-card';
import { QuickStatsCard } from './Gamification/quick-stats-card';
import { RecentActivityFeed } from './Gamification/recent-activity-feed';

interface GamificationDashboardProps {
  orgId: number;
}

/**
 * Unified Gamification Dashboard (Server Component)
 *
 * Directly fetches gamification data and renders the dashboard.
 * This replaces the old pattern of:
 *   LearnerDashboard.server.tsx -> LearnerDashboard.tsx -> LearnerDashboardContent
 *
 * Now it's just:
 *   gamification-dashboard.tsx (fetches data) -> Client UI components
 */
export default async function GamificationDashboard({ orgId }: GamificationDashboardProps) {
  const session = await auth();
  const userId = session?.user?.id;

  try {
    // Fetch dashboard data and leaderboard in parallel
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

    return (
      <GamificationProvider orgId={orgId} initialData={{ dashboard: dashboardData, profile: dashboardData.profile }}>
        <div className="space-y-6">
          {/* Top Row: Profile & Quick Stats */}
          <div className="grid gap-6 md:grid-cols-2">
            <ProfileCard profile={dashboardData.profile} />
            <QuickStatsCard profile={dashboardData.profile} />
          </div>

          {/* Bottom Row: Recent Activity & Leaderboard */}
          <div className="grid gap-6 md:grid-cols-2">
            <RecentActivityFeed transactions={dashboardData.recent_transactions || []} />
            <LeaderboardCard entries={leaderboardData.entries} currentUserId={userId ? Number(userId) : undefined} />
          </div>
        </div>
      </GamificationProvider>
    );
  } catch (error) {
    return <DashboardError error={error instanceof Error ? error.message : 'Unknown error'} />;
  }
}

/**
 * Error Display Component
 */
function DashboardError({ error }: { error: string }) {
  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
      <p className="text-destructive font-semibold">Error loading dashboard</p>
      <p className="text-muted-foreground text-sm">{error}</p>
    </div>
  );
}

/**
 * Loading Skeleton
 */
export function GamificationDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-[280px]" />
        <Skeleton className="h-[280px]" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-[450px]" />
        <Skeleton className="h-[450px]" />
      </div>
    </div>
  );
}
