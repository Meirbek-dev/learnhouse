'use client';

import { Award, Calendar, Flame, Star, TrendingUp, Trophy, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RequestBodyWithAuthHeader } from '@/services/utils/ts/requests';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useFormatter, useTranslations } from 'next-intl';
import { getAPIUrl } from '@/services/config/config';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSession } from 'next-auth/react';

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
  created_at: string;
  updated_at: string;
  version: number;
}

interface XPTransaction {
  id: number;
  user_id: number;
  org_id: number;
  xp_amount: number;
  source: string;
  source_id: string | null;
  transaction_metadata: Record<string, any>;
  created_at: string;
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
  onProfileUpdate?: (profile: GamificationProfile) => void;
}

// Memoized components for better performance
const XPSourceIcon = ({ source }: { source: string }) => {
  const iconMap: Record<string, React.ReactNode> = useMemo(
    () => ({
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
    }),
    [],
  );
  return iconMap[source] || <Star className="h-4 w-4" />;
};

const TransactionItem = ({
  transaction,
  formatTransactionDate,
  formatXPAmount,
  getXpSourceDisplayName,
}: {
  transaction: XPTransaction;
  formatTransactionDate: (date: string) => string;
  formatXPAmount: (amount: number) => string;
  getXpSourceDisplayName: (source: string) => string;
}) => (
  <div className="bg-muted/50 flex items-center justify-between rounded-lg p-3">
    <div className="flex items-center gap-3">
      <XPSourceIcon source={transaction.source} />
      <div>
        <p className="text-sm font-medium">{getXpSourceDisplayName(transaction.source)}</p>
        <p className="text-muted-foreground text-xs">{formatTransactionDate(transaction.created_at)}</p>
      </div>
    </div>
    <Badge variant={transaction.xp_amount > 0 ? 'default' : 'destructive'}>
      {formatXPAmount(transaction.xp_amount)}
    </Badge>
  </div>
);

export function GamificationDashboard({ orgId, className = '', onProfileUpdate }: GamificationDashboardProps) {
  const { data: session } = useSession();
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');
  const format = useFormatter();

  const [dashboardData, setDashboardData] = useState<GamificationDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Memoized helper functions
  const calculateLevelProgress = useCallback((profile: GamificationProfile): number => {
    const xpForCurrentLevel = 100 * 1.2 ** (profile.current_level - 1);
    const xpForNextLevel = 100 * 1.2 ** profile.current_level;
    const totalXpNeeded = xpForNextLevel - xpForCurrentLevel;
    const currentProgress = totalXpNeeded - profile.xp_to_next_level;
    return Math.max(0, Math.min(100, (currentProgress / totalXpNeeded) * 100));
  }, []);

  const getXpSourceDisplayName = useCallback(
    (source: string): string => {
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
    },
    [t],
  );

  const formatTransactionDate = useCallback(
    (dateString: string): string => {
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
          throw new Error('Invalid date');
        }
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
    },
    [format],
  );

  const formatXPAmount = useCallback(
    (amount: number): string => {
      const sign = amount > 0 ? '+' : '';
      const formattedNumber = format.number(Math.abs(amount));
      return `${sign}${formattedNumber} XP`;
    },
    [format],
  );

  const fetchDashboardData = useCallback(
    async (isRefresh = false) => {
      if (!session?.tokens?.access_token) {
        setError(t('dashboard.notAuthenticated'));
        setIsLoading(false);
        return;
      }

      try {
        if (isRefresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setError(null);

        const response = await fetch(
          `${getAPIUrl()}gamification/dashboard/${orgId}`,
          RequestBodyWithAuthHeader('GET', null, null, session.tokens.access_token),
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(t('dashboard.profileNotFound'));
          } else if (response.status === 403) {
            throw new Error(t('dashboard.accessDenied'));
          } else {
            throw new Error(`${t('dashboard.fetchError')}: ${response.statusText}`);
          }
        }

        const data = await response.json();

        // Validate the response data
        if (!data || !data.profile) {
          throw new Error(t('dashboard.invalidResponse'));
        }

        setDashboardData(data);
        setRetryCount(0); // Reset retry count on success

        // Notify parent component of profile update
        if (onProfileUpdate && data.profile) {
          onProfileUpdate(data.profile);
        }
      } catch (error) {
        console.error('Error fetching gamification dashboard:', error);
        const errorMessage = error instanceof Error ? error.message : t('dashboard.unexpectedError');
        setError(errorMessage);

        // Increment retry count for exponential backoff
        setRetryCount((prev) => prev + 1);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [orgId, session?.tokens?.access_token, t, onProfileUpdate],
  );

  const handleRetry = useCallback(() => {
    fetchDashboardData(false);
  }, [fetchDashboardData]);

  const handleRefresh = useCallback(() => {
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  // Initial fetch
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Auto-retry logic with exponential backoff
  useEffect(() => {
    if (error && retryCount > 0 && retryCount <= 3) {
      const retryDelay = Math.min(1000 * Math.pow(2, retryCount - 1), 10000); // Cap at 10s
      const timer = setTimeout(() => {
        console.log(`Retrying gamification dashboard fetch (attempt ${retryCount})`);
        fetchDashboardData();
      }, retryDelay);

      return () => clearTimeout(timer);
    }
  }, [error, retryCount, fetchDashboardData]);

  // Memoized computed values
  const levelProgress = useMemo(() => {
    return dashboardData?.profile ? calculateLevelProgress(dashboardData.profile) : 0;
  }, [dashboardData?.profile, calculateLevelProgress]);

  const sortedTransactions = useMemo(() => {
    if (!dashboardData?.recent_xp_transactions) return [];

    return [...dashboardData.recent_xp_transactions]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);
  }, [dashboardData?.recent_xp_transactions]);

  if (isLoading) {
    return <LoadingSkeleton className={className} />;
  }

  if (error || !dashboardData) {
    return (
      <ErrorState
        className={className}
        error={error || t('dashboard.failedToLoad')}
        onRetry={handleRetry}
        retryCount={retryCount}
        isRetrying={isLoading}
      />
    );
  }

  const { profile, rank_in_organization } = dashboardData;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Profile Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {t('dashboard.yourProgress')}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
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
      {sortedTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              {t('dashboard.recentActivities')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedTransactions.map((transaction) => (
                <TransactionItem
                  key={transaction.id}
                  transaction={transaction}
                  formatTransactionDate={formatTransactionDate}
                  formatXPAmount={formatXPAmount}
                  getXpSourceDisplayName={getXpSourceDisplayName}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Memoized loading skeleton component
const LoadingSkeleton = ({ className }: { className: string }) => (
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

// Error state component with retry logic
const ErrorState = ({
  className,
  error,
  onRetry,
  retryCount,
  isRetrying,
}: {
  className: string;
  error: string;
  onRetry: () => void;
  retryCount: number;
  isRetrying: boolean;
}) => {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');

  return (
    <Card className={className}>
      <CardContent className="p-6 text-center">
        <Alert className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Button
            variant="outline"
            onClick={onRetry}
            disabled={isRetrying}
            className="inline-flex items-center gap-2"
          >
            {isRetrying && <RefreshCw className="h-4 w-4 animate-spin" />}
            {t('dashboard.tryAgain')}
          </Button>

          {retryCount > 0 && (
            <p className="text-sm text-muted-foreground">{t('dashboard.retryAttempt', { count: retryCount })}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
