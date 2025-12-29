'use client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import TypeOfContentTitle from '@components/Objects/StyledElements/Titles/TypeOfContentTitle';
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper';
import { RecentActivityFeed } from '@/components/Dashboard/Gamification/recent-activity-feed';
import { useOptionalGamificationContext } from '@/components/Contexts/GamificationContext';
import { Leaderboard } from '@/components/Dashboard/Gamification/leaderboard';
import TrailCourseElement from '@components/Pages/Trail/TrailCourseElement';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { revalidateTags, swrFetcher } from '@services/utils/ts/requests';
import { getTrailSwrKey } from '@services/courses/keys';
import UserCertificates from '@components/Pages/Trail/UserCertificates';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { AlertTriangle, BookOpen, Loader2 } from 'lucide-react';
import { removeCourse } from '@services/courses/activity';
import { useOrg } from '@components/Contexts/OrgContext';
import { getAPIUrl } from '@services/config/config';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';

const Trail = (params: any) => {
  const { orgslug } = params;
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const org = useOrg() as any;
  const orgID = org?.id;
  const t = useTranslations('TrailPage');
  const router = useRouter();
  const [isQuittingAll, setIsQuittingAll] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [quittingProgress, setQuittingProgress] = useState(0);
  const [isQuitDialogOpen, setIsQuitDialogOpen] = useState(false);

  const TRAIL_KEY = orgID ? getTrailSwrKey(orgID) : null;
  const {
    data: trail,
    error,
    mutate,
  } = useSWR(TRAIL_KEY && access_token ? [TRAIL_KEY, access_token] : null, ([url, token]) => swrFetcher(url, token));

  // Use gamification context (already available from parent layout)
  const gamificationContext = useOptionalGamificationContext();
  const gamificationData = {
    profile: gamificationContext?.profile,
    recent_transactions: gamificationContext?.dashboard?.recent_transactions || [],
    user_rank: gamificationContext?.dashboard?.user_rank,
  };
  const isGamificationLoading = gamificationContext?.isLoading || false;

  const { data: leaderboardData, isLoading: isLeaderboardLoading } = useSWR(
    orgID ? `${getAPIUrl()}gamification/${orgID}/leaderboard?limit=10` : null,
    (url) => swrFetcher(url, access_token),
  );

  const { data: userRankData } = useSWR(orgID ? `${getAPIUrl()}gamification/${orgID}/rank` : null, (url) =>
    swrFetcher(url, access_token),
  );

  const handleQuitAllCourses = async () => {
    if (!trail?.runs?.length || isQuittingAll) return;

    startTransition(() => setIsQuittingAll(true));
    const totalCourses = trail.runs.length;

    try {
      for (let i = 0; i < trail.runs.length; i += 1) {
        const run = trail.runs[i];
        await removeCourse(run.course.course_uuid, orgslug, access_token);
        setQuittingProgress(Math.round(((i + 1) / totalCourses) * 100));
      }

      await revalidateTags(['courses'], orgslug);
      router.refresh();
      await mutate();
      setIsQuitDialogOpen(false);
    } catch (error) {
      console.error('Error quitting courses:', error);
    } finally {
      startTransition(() => setIsQuittingAll(false));
      startTransition(() => setQuittingProgress(0));
    }
  };

  return (
    <GeneralWrapperStyled>
      <div className="mb-6 flex items-center justify-between">
        <TypeOfContentTitle
          title={t('title')}
          type="tra"
        />
        {trail?.runs?.length > 0 && (
          <AlertDialog
            open={isQuitDialogOpen}
            onOpenChange={setIsQuitDialogOpen}
          >
            <AlertDialogTrigger
              render={
                <button
                  disabled={isQuittingAll || isPending}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    isQuittingAll || isPending
                      ? 'cursor-not-allowed bg-gray-100 text-gray-500'
                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
                >
                  {isQuittingAll || isPending
                    ? t('quittingProgress', { progress: quittingProgress })
                    : t('quitAllCourses')}
                </button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400">
                  <AlertTriangle className="size-8" />
                </AlertDialogMedia>
                <AlertDialogTitle>{t('quitAllCoursesDialogTitle')}</AlertDialogTitle>
                <AlertDialogDescription>{t('quitAllCoursesConfirmation')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel />
                <AlertDialogAction
                  variant="destructive"
                  onClick={handleQuitAllCourses}
                  disabled={isQuittingAll || isPending}
                >
                  {isQuittingAll || isPending ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      {t('quittingProgress', { progress: quittingProgress })}
                    </div>
                  ) : (
                    t('quitAllCourses')
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="space-y-8">
        {/* Progress Section */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center space-x-3">
            <BookOpen className="h-6 w-6 text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-900">{t('myProgress')}</h2>
            {trail?.runs ? (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                {trail.runs.length}
              </span>
            ) : null}
          </div>

          {!trail ? (
            <PageLoading />
          ) : trail.runs.length === 0 ? (
            <div className="py-8 text-center">
              <BookOpen className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">{t('noCoursesInProgress')}</p>
              <p className="mt-1 text-sm text-gray-400">{t('startACourseToSeeYourProgress')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {trail.runs.map((run: any) => (
                <TrailCourseElement
                  key={run.course.course_uuid}
                  run={run}
                  course={run.course}
                  orgslug={orgslug}
                />
              ))}
            </div>
          )}
        </div>

        {/* Certificates Section */}
        <UserCertificates orgslug={orgslug} />

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
    </GeneralWrapperStyled>
  );
};

export default Trail;
