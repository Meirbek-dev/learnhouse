'use client';
import { RecentActivityFeed } from '@/components/Dashboard/Gamification/recent-activity-feed';
import GeneralWrapper from '@/components/Objects/Elements/Wrappers/GeneralWrapper';
import { Leaderboard } from '@/components/Dashboard/Gamification/leaderboard';
import TrailCourseElement from '@components/Pages/Trail/TrailCourseElement';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import UserCertificates from '@components/Pages/Trail/UserCertificates';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { useGamificationStore } from '@/stores/gamification';
import { swrFetcher } from '@services/utils/ts/requests';
import { getTrailSwrKey } from '@services/courses/keys';
import { getAPIUrl } from '@services/config/config';
import { useTranslations } from 'next-intl';
import { BookOpen } from 'lucide-react';
import useSWR from 'swr';

const EMPTY_RECENT_TRANSACTIONS: any[] = [];

const Trail = () => {
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('TrailPage');

  const TRAIL_KEY = getTrailSwrKey();
  const {
    data: trail,
    error,
    mutate,
  } = useSWR(TRAIL_KEY && access_token ? [TRAIL_KEY, access_token] : null, ([url, token]) => swrFetcher(url, token));

  const gamificationProfile = useGamificationStore((s) => s.profile);
  const recentTransactions = useGamificationStore((s) => s.dashboard?.recent_transactions ?? EMPTY_RECENT_TRANSACTIONS);
  const userRank = useGamificationStore((s) => s.dashboard?.user_rank);
  const isGamificationLoading = useGamificationStore((s) => s.isLoading);
  const gamificationData = {
    profile: gamificationProfile,
    recent_transactions: recentTransactions,
    user_rank: userRank,
  };

  const { data: leaderboardData, isLoading: isLeaderboardLoading } = useSWR(
    access_token ? `${getAPIUrl()}gamification/leaderboard?limit=10` : null,
    (url) => swrFetcher(url, access_token),
  );

  const userRankData = { rank: gamificationData.user_rank };

  return (
    <GeneralWrapper>
      <div className="space-y-8">
        {/* Progress Section */}
        <div className="rounded-xl bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center space-x-3">
            <BookOpen className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">{t('myProgress')}</h2>
            {trail?.runs ? (
              <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                {trail.runs.length}
              </span>
            ) : null}
          </div>

          {!trail ? (
            <PageLoading />
          ) : trail.runs.length === 0 ? (
            <div className="py-8 text-center">
              <BookOpen className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">{t('noCoursesInProgress')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('startACourseToSeeYourProgress')}</p>
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
            currentUserId={session?.data?.user?.id ? Number(session.data.user.id) : undefined}
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
