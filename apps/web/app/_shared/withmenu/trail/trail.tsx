'use client';
import { RecentActivityFeed } from '@/components/Dashboard/Gamification/recent-activity-feed';
import GeneralWrapper from '@/components/Objects/Elements/Wrappers/GeneralWrapper';
import { Leaderboard } from '@/components/Dashboard/Gamification/leaderboard';
import TrailCourseElement from '@components/Pages/Trail/TrailCourseElement';
import { useSession } from '@/hooks/useSession';
import UserCertificates from '@components/Pages/Trail/UserCertificates';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { useGamificationStore } from '@/stores/gamification';
import { useTrailCurrent, useTrailLeaderboard } from '@/features/trail/hooks/useTrail';
import { useTranslations } from 'next-intl';
import { BookOpen } from 'lucide-react';

const EMPTY_RECENT_TRANSACTIONS: any[] = [];

const Trail = () => {
  const { user: currentUser } = useSession();
  const t = useTranslations('TrailPage');

  const { data: trail } = useTrailCurrent();

  const gamificationProfile = useGamificationStore((s) => s.profile);
  const recentTransactions = useGamificationStore((s) => s.dashboard?.recent_transactions ?? EMPTY_RECENT_TRANSACTIONS);
  const userRank = useGamificationStore((s) => s.dashboard?.user_rank);
  const isGamificationLoading = useGamificationStore((s) => s.isLoading);
  const gamificationData = {
    profile: gamificationProfile,
    recent_transactions: recentTransactions,
    user_rank: userRank,
  };

  const { data: leaderboardData } = useTrailLeaderboard(10);

  const userRankData = { rank: gamificationData.user_rank };

  return (
    <GeneralWrapper>
      <div className="space-y-8">
        {/* Progress Section */}
        <div className="bg-card rounded-xl p-6 shadow-sm">
          <div className="mb-6 flex items-center space-x-3">
            <BookOpen className="text-primary h-6 w-6" />
            <h2 className="text-foreground text-xl font-semibold">{t('myProgress')}</h2>
            {trail?.runs ? (
              <span className="bg-primary/20 text-primary-foreground rounded-full px-2.5 py-0.5 text-xs font-medium">
                {trail.runs.length}
              </span>
            ) : null}
          </div>

          {!trail ? (
            <PageLoading />
          ) : trail.runs.length === 0 ? (
            <div className="py-8 text-center">
              <BookOpen className="text-muted-foreground mx-auto mb-3 h-12 w-12" />
              <p className="text-muted-foreground">{t('noCoursesInProgress')}</p>
              <p className="text-muted-foreground mt-1 text-sm">{t('startACourseToSeeYourProgress')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {trail.runs.map((run: any) => (
                <TrailCourseElement
                  key={run.course.course_uuid}
                  run={run}
                  course={run.course}
                />
              ))}
            </div>
          )}
        </div>

        {/* Certificates Section */}
        <UserCertificates />

        {/* Gamification Section - Recent Activity and Leaderboard */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Leaderboard */}
          <Leaderboard
            entries={leaderboardData?.entries || []}
            currentUserId={currentUser?.id || undefined}
            userRank={userRankData?.rank}
          />

          {/* Recent Activity Feed */}
          <RecentActivityFeed
            transactions={gamificationData?.recent_transactions || []}
            isLoading={isGamificationLoading}
          />
        </div>
      </div>
    </GeneralWrapper>
  );
};

export default Trail;
