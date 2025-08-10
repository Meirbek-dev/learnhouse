'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Calendar, Flame, Star, TrendingUp, Trophy } from 'lucide-react';
import { RequestBodyWithAuthHeader } from '@/services/utils/ts/requests';
import { useFormatter, useTranslations } from 'next-intl';
import { getAPIUrl } from '@/services/config/config';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

interface GamificationProfile {
  id: number;
  user_id: number;
  org_id: number;
  total_xp: number;
  current_level: number;
  xp_to_next_level: number;
  current_login_streak: number;
  longest_login_streak: number;
  current_learning_streak: number;
  longest_learning_streak: number;
  last_login_date: string | null;
  last_learning_activity_date: string | null;
  profile_data: Record<string, any>;
  creation_date: string;
  update_date: string;
}

interface XPTransaction {
  id: number;
  user_id: number;
  org_id: number;
  xp_amount: number;
  xp_source: string;
  xp_context: Record<string, any>;
  related_activity_id: number | null;
  related_course_id: number | null;
  related_trail_step_id: number | null;
  creation_date: string;
}

interface GamificationDashboard {
  profile: GamificationProfile;
  recent_xp_transactions: XPTransaction[];
  active_streaks: any[];
  total_activities_completed: number;
  total_courses_completed: number;
  total_certificates: number;
  rank_in_organization: number | null;
}

interface GamificationDashboardProps {
  orgId: number;
  className?: string;
}

export function GamificationDashboard({ orgId, className = '' }: GamificationDashboardProps) {
  const { data: session } = useSession();
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');
  const format = useFormatter();
  const [dashboardData, setDashboardData] = useState<GamificationDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!session?.tokens?.access_token) return;

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `${getAPIUrl()}gamification/dashboard/${orgId}`,
          RequestBodyWithAuthHeader('GET', null, null, session.tokens.access_token),
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch gamification data: ${response.statusText}`);
        }

        const data = await response.json();
        setDashboardData(data);
      } catch (error) {
        console.error('Error fetching gamification dashboard:', error);
        setError(error instanceof Error ? error.message : t('dashboard.failedToLoad'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [orgId, session?.tokens?.access_token, t]);

  const calculateLevelProgress = (profile: GamificationProfile) => {
    const xpForCurrentLevel = 100 * 1.2 ** (profile.current_level - 1);
    const xpForNextLevel = 100 * 1.2 ** profile.current_level;
    const totalXpNeeded = xpForNextLevel - xpForCurrentLevel;
    const currentProgress = totalXpNeeded - profile.xp_to_next_level;
    return Math.max(0, Math.min(100, (currentProgress / totalXpNeeded) * 100));
  };

  const getXpSourceDisplayName = (source: string) => {
    const sourceMap: Record<string, string> = {
      login_daily: t('xpSources.login_daily'),
      activity_completion: t('xpSources.activity_completion'),
      course_completion: t('xpSources.course_completion'),
      perfect_score: t('xpSources.perfect_score'),
      first_activity: t('xpSources.first_activity'),
      login_streak_7_days: t('xpSources.login_streak_7_days'),
      login_streak_30_days: t('xpSources.login_streak_30_days'),
      login_streak_100_days: t('xpSources.login_streak_100_days'),
      streak_bonus_7_days: t('xpSources.login_streak_7_days'),
      streak_bonus_30_days: t('xpSources.login_streak_30_days'),
      streak_bonus_100_days: t('xpSources.login_streak_100_days'),
    };
    return sourceMap[source] || t('xpSources.unknown', { source });
  };

  const getXpSourceIcon = (source: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      login_daily: <Calendar className="h-4 w-4" />,
      activity_completion: <Star className="h-4 w-4" />,
      course_completion: <Trophy className="h-4 w-4" />,
      perfect_score: <Award className="h-4 w-4" />,
      first_activity: <Star className="h-4 w-4" />,
      login_streak_7_days: <Flame className="h-4 w-4" />,
      login_streak_30_days: <Flame className="h-4 w-4" />,
      login_streak_100_days: <Award className="h-4 w-4" />,
      streak_bonus_7_days: <Flame className="h-4 w-4" />,
      streak_bonus_30_days: <Flame className="h-4 w-4" />,
      streak_bonus_100_days: <Award className="h-4 w-4" />,
    };
    return iconMap[source] || <Star className="h-4 w-4" />;
  };

  // Helper function to format dates for display
  const formatTransactionDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format.dateTime(date, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.warn('Invalid date format in formatTransactionDate:', dateString, error);
      return dateString;
    }
  };

  // Helper function to format XP amounts with locale
  const formatXPAmount = (amount: number) => {
    const sign = amount > 0 ? '+' : '';
    const formattedNumber = format.number(Math.abs(amount));
    return `${sign}${formattedNumber} XP`;
  };

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="mb-2 h-8 w-8" />
                <Skeleton className="mb-1 h-4 w-16" />
                <Skeleton className="h-6 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">{error || t('dashboard.failedToLoad')}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            {t('dashboard.tryAgain')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { profile, recent_xp_transactions, rank_in_organization } = dashboardData;
  const levelProgress = calculateLevelProgress(profile);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {t('dashboard.yourProgress')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Level and XP */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">{t('levelIndicators.level')}</p>
                <p className="text-2xl font-bold">{profile.current_level}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground text-sm">{t('stats.totalXP')}</p>
                <p className="text-2xl font-bold">{format.number(profile.total_xp)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('levelIndicators.xpToLevel', { level: profile.current_level + 1 })}</span>
                <span>
                  {profile.xp_to_next_level} {t('levelIndicators.xpToNext')}
                </span>
              </div>
              <Progress
                value={levelProgress}
                className="h-3"
              />
            </div>

            {rank_in_organization && (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">{t('dashboard.rankInOrg', { rank: rank_in_organization })}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent XP Transactions */}
      {recent_xp_transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              {t('dashboard.recentActivities')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recent_xp_transactions.slice(0, 10).map((transaction) => (
                <div
                  key={transaction.id}
                  className="bg-muted/50 flex items-center justify-between rounded-lg p-3"
                >
                  <div className="flex items-center gap-3">
                    {getXpSourceIcon(transaction.xp_source)}
                    <div>
                      <p className="text-sm font-medium">{getXpSourceDisplayName(transaction.xp_source)}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatTransactionDate(transaction.creation_date)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={transaction.xp_amount > 0 ? 'default' : 'destructive'}>
                    {formatXPAmount(transaction.xp_amount)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
