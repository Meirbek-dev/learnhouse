import { getServerGamificationDashboard, getServerOrganizationLeaderboard } from '@/services/gamification/server';
import { GamificationProvider } from '@/components/Contexts/GamificationContext';
import { RecentActivityFeed } from './Gamification/recent-activity-feed';
import { HeroSection } from './Gamification/hero-section';
import { Leaderboard } from './Gamification/leaderboard';
import { Skeleton } from '@/components/ui/skeleton';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';

interface GamificationDashboardProps {
  orgId: number;
}

/**
 * Unified Gamification Dashboard (Server Component)
 *
 * Fetches gamification data and renders dashboard components.
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
      <GamificationProvider
        orgId={orgId}
        initialData={{ dashboard: dashboardData, profile: dashboardData.profile }}
      >
        <div className="space-y-6">
          {/* Hero Section - Main Profile & Stats */}
          <HeroSection
            profile={dashboardData.profile}
            userRank={dashboardData.user_rank}
          />

          {/* Two Column Layout */}
          <div className="grid gap-6 lg:grid-cols-2">
            <RecentActivityFeed transactions={dashboardData.recent_transactions || []} />

            {/* Right Column: Leaderboard */}
            <div>
              <Leaderboard
                entries={leaderboardData.entries}
                currentUserId={userId ? Number(userId) : undefined}
                userRank={dashboardData.user_rank}
              />
            </div>
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
async function DashboardError({ error }: { error: string }) {
  const t = await getTranslations('DashPage.UserAccountSettings.Gamification');

  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
      <p className="text-destructive font-semibold">{t('dashboardErrors.errorLoading')}</p>
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
      {/* Hero Skeleton */}
      <Skeleton className="h-[240px]" />

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[300px]" />
        </div>
        <Skeleton className="h-[700px]" />
      </div>
    </div>
  );
}
