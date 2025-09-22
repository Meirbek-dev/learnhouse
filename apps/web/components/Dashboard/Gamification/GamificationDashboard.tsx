'use client';

import type { DashboardData, UserGamificationProfile, XPTransaction } from '@/types/gamification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Calendar, Flame, Star, TrendingUp, Trophy } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface GamificationDashboardProps {
  orgId: number;
  className?: string;
  onProfileUpdate?: (profile: UserGamificationProfile) => void;
  data?: DashboardData | null;
}

// Memoized components for better performance
const XPSourceIcon = ({ activityType }: { activityType: string }) => {
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
  return iconMap[activityType] || <Star className="h-4 w-4" />;
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
}) => {
  const source = (transaction as any).source ?? 'unknown';
  return (
    <div className="bg-muted/50 flex items-center justify-between rounded-lg p-3">
      <div className="flex items-center gap-3">
        <XPSourceIcon activityType={source} />
        <div>
          <p className="text-sm font-medium">{getXpSourceDisplayName(source)}</p>
          <p className="text-muted-foreground text-xs">{formatTransactionDate(transaction.created_at)}</p>
        </div>
      </div>
      <Badge variant={transaction.amount > 0 ? 'default' : 'destructive'}>{formatXPAmount(transaction.amount)}</Badge>
    </div>
  );
};

export function GamificationDashboard({
  orgId,
  className = '',
  onProfileUpdate,
  data: serverData,
}: GamificationDashboardProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');
  const format = useFormatter();

  const dashboardData = serverData ?? null;

  // Memoized helper functions
  const getXpSourceDisplayName = useCallback(
    (source: string): string => {
      // 1) Translation (if key exists), 2) Humanized fallback
      try {
        return t(`xpSources.${source}` as any);
      } catch {
        return source.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      }
    },
    [t],
  );

  const formatTransactionDate = useCallback(
    (dateString: string): string => {
      try {
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) {
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

  // No client fetching; this component is purely presentational.
  useEffect(() => {
    if (onProfileUpdate && dashboardData?.profile) {
      try {
        onProfileUpdate(dashboardData.profile);
      } catch {}
    }
  }, [onProfileUpdate, dashboardData?.profile]);

  // Memoized computed values
  const levelProgress = useMemo(() => {
    if (!dashboardData?.profile) return 0;
    const p: any = dashboardData.profile;
    return p.level_progress_percent ?? 0;
  }, [dashboardData?.profile]);

  const sortedTransactions = useMemo(() => {
    const list: XPTransaction[] = dashboardData?.recent_transactions ?? [];
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);
  }, [dashboardData]);

  if (!dashboardData) {
    return <LoadingSkeleton className={className} />;
  }

  const { profile, user_rank } = dashboardData;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Profile Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {t('dashboard.yourProgress')}
          </CardTitle>
          {/* Refresh action handled by parent/server; no client fetch here */}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">{t('levelIndicators.level')}</p>
                <p className="text-2xl font-bold">{profile.level}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground text-sm">{t('stats.totalXP')}</p>
                <p className="text-2xl font-bold">{format.number(profile.total_xp)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('levelIndicators.xpToLevel', { level: profile.level + 1 })}</span>
                <span>
                  {(profile as any).xp_to_next_level ?? 0} {t('levelIndicators.xpToNext')}
                </span>
              </div>
              <Progress
                value={levelProgress}
                className="h-3"
              />
            </div>

            {user_rank != null && (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">{t('dashboard.rankInOrg', { rank: user_rank })}</span>
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
// Legacy ErrorState removed (no client fetching)
