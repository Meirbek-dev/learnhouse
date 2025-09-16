'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, Calendar, Flame, RefreshCw, Star, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGamificationProfile } from '@/hooks/useGamificationProfile';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCallback, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Note: Profile shape comes from services/gamification. It exposes `streaks`
// as either a mapping { login: number, learning: number } or a generic map.
// It does not guarantee last_activity fields; this widget derives display-safe
// values and guards for missing data.

interface StreakWidgetProps {
  orgId: number;
  className?: string;
}

export function StreakWidget({ orgId, className = '' }: StreakWidgetProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification.streakWidget');
  const locale = useLocale();
  const format = useFormatter();
  const { profile, isLoading, error, refetch } = useGamificationProfile({ orgId, enabled: true });
  const [retryCount, setRetryCount] = useState(0);
  const handleRetry = useCallback(() => {
    if (retryCount < 3) {
      setRetryCount((prev) => prev + 1);
      refetch();
    }
  }, [retryCount, refetch]);

  const getStreakStatus = useCallback(
    (lastActivityDate: string | null) => {
      if (!lastActivityDate) return 'none';

      try {
        const lastDate = new Date(lastActivityDate);
        const today = new Date();

        // Use locale-aware date comparison
        const lastDateString = lastDate.toLocaleDateString(locale, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        const todayString = today.toLocaleDateString(locale, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });

        // Reset time to compare dates only
        lastDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        const diffTime = today.getTime() - lastDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0 || diffDays === 1) return 'active';
        if (diffDays === 2) return 'at-risk';
        return 'broken';
      } catch (error) {
        console.warn('Invalid date format in getStreakStatus:', lastActivityDate, error);
        return 'none';
      }
    },
    [locale],
  );

  const getStreakBadgeVariant = useCallback((status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'active': {
        return 'default';
      }
      case 'at-risk': {
        return 'secondary';
      }
      case 'broken': {
        return 'destructive';
      }
      default: {
        return 'outline';
      }
    }
  }, []);

  const getStreakMessage = useCallback(
    (streak: number, status: string, type: 'login' | 'learning') => {
      if (status === 'active' && streak > 0) {
        return t('streakMessages.active', {
          count: streak,
          plural: streak > 1 ? 's' : '',
        });
      }
      if (status === 'at-risk') {
        const action = type === 'login' ? t('streakMessages.loginAction') : t('streakMessages.completeAction');
        return t('streakMessages.atRisk', { action });
      }
      if (status === 'broken' || streak === 0) {
        const typeText = type === 'login' ? t('streakMessages.login') : t('streakMessages.learning');
        return t('streakMessages.broken', { type: typeText });
      }
      return '';
    },
    [t],
  );

  // format dates for display
  const formatLastActivityDate = useCallback(
    (dateString: string | null) => {
      if (!dateString) return t('tooltips.noActivity');

      try {
        const date = new Date(dateString);
        return format.dateTime(date, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch (error) {
        console.warn('Invalid date format in formatLastActivityDate:', dateString, error);
        return t('tooltips.invalidDate');
      }
    },
    [format, t],
  );

  // Helper function to get relative time for last activity
  const getRelativeTime = useCallback(
    (dateString: string | null) => {
      if (!dateString) return t('tooltips.noActivity');

      try {
        const date = new Date(dateString);
        const now = new Date();
        return format.relativeTime(date, now);
      } catch (error) {
        console.warn('Invalid date format in getRelativeTime:', dateString, error);
        return t('tooltips.invalidDate');
      }
    },
    [format, t],
  );

  // Localized day(s) using next-intl's number formatting
  const formatDays = useCallback(
    (count: number) => {
      const formattedNumber = format.number(count);
      return t('days', { count: formattedNumber });
    },
    [format, t],
  );

  const streakData = useMemo(() => {
    if (!profile) return null;

    // Extract streak counts from flexible profile.streaks
    const rawStreaks: any = (profile as any).streaks ?? {};
    let loginCurrent = 0;
    let loginLongest = 0;
    let learningCurrent = 0;
    let learningLongest = 0;

    if (rawStreaks) {
      // Support: { login: number } OR { login: { current, longest } }
      const sLogin = rawStreaks.login;
      const sLearning = rawStreaks.learning;
      if (typeof sLogin === 'number') {
        loginCurrent = sLogin;
        loginLongest = sLogin; // fallback: no separate longest provided
      } else if (sLogin && typeof sLogin === 'object') {
        loginCurrent = Number(sLogin.current) || 0;
        loginLongest = Number(sLogin.longest) || loginCurrent;
      }
      if (typeof sLearning === 'number') {
        learningCurrent = sLearning;
        learningLongest = sLearning;
      } else if (sLearning && typeof sLearning === 'object') {
        learningCurrent = Number(sLearning.current) || 0;
        learningLongest = Number(sLearning.longest) || learningCurrent;
      }
    }

    // Last activity fields are not part of the normalized profile; treat as optional
    const loginLast: string | null = (profile as any)?.last_activity?.login ?? null;
    const learningLast: string | null = (profile as any)?.last_activity?.learning ?? null;
    return {
      loginStatus: getStreakStatus(loginLast),
      learningStatus: getStreakStatus(learningLast),
      loginMessage: getStreakMessage(loginCurrent, getStreakStatus(loginLast), 'login'),
      learningMessage: getStreakMessage(learningCurrent, getStreakStatus(learningLast), 'learning'),
      current_login_streak: loginCurrent, // local structure for rendering
      longest_login_streak: loginLongest,
      current_learning_streak: learningCurrent,
      longest_learning_streak: learningLongest,
      last_login_date: loginLast,
      last_learning_activity_date: learningLast,
    } as any;
  }, [profile, getStreakStatus, getStreakMessage]);

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-lg" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border bg-gradient-to-r from-orange-50 to-red-50 p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-8" />
                </div>
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
            <div className="flex items-center justify-between rounded-xl border bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-8" />
                </div>
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state with retry functionality
  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-sm">{error}</span>
              {retryCount < 3 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="ml-2"
                >
                  <RefreshCw className="mr-1 h-4 w-4" />
                  {t('retry')}
                </Button>
              ) : (
                <span className="text-muted-foreground text-xs">{t('retryLimit')}</span>
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!(profile && streakData)) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flame className="h-5 w-5" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-4 text-center">
            <div className="mb-3 inline-block rounded-full bg-gray-100 p-4 dark:bg-gray-800">
              <Flame className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-muted-foreground mb-2 text-sm">{t('noData')}</p>
            <p className="text-muted-foreground text-xs">{t('noDataSubtext')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { loginStatus, learningStatus, loginMessage, learningMessage } = streakData as any;

  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Login Streak */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help rounded-lg border bg-gradient-to-br from-orange-50 to-red-50 p-4 transition-shadow hover:shadow-sm dark:from-orange-950/20 dark:to-red-950/20">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-orange-500" />
                    <h3 className="font-semibold">{t('loginStreak')}</h3>
                  </div>
                  <Badge variant={getStreakBadgeVariant(loginStatus)}>
                    {formatDays(streakData.current_login_streak)}
                  </Badge>
                </div>

                <p className="text-muted-foreground mb-2 text-sm">{loginMessage}</p>

                {streakData.longest_login_streak > streakData.current_login_streak && (
                  <p className="text-muted-foreground text-xs">
                    {t('personalBest', { count: streakData.longest_login_streak })}
                  </p>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p>{t('tooltips.login')}</p>
                {(streakData as any).last_login_date && (
                  <div className="text-xs font-extralight">
                    <p>
                      {t('tooltips.lastActivity')}: {getRelativeTime((streakData as any).last_login_date)}
                    </p>
                    <p>{formatLastActivityDate((streakData as any).last_login_date)}</p>
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>

          {/* Learning Streak */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help rounded-lg border bg-gradient-to-br from-blue-50 to-indigo-50 p-4 transition-shadow hover:shadow-sm dark:from-blue-950/20 dark:to-indigo-950/20">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-blue-500" />
                    <h3 className="font-semibold">{t('learningStreak')}</h3>
                  </div>
                  <Badge variant={getStreakBadgeVariant(learningStatus)}>
                    {formatDays(streakData.current_learning_streak)}
                  </Badge>
                </div>

                <p className="text-muted-foreground mb-2 text-sm">{learningMessage}</p>

                {streakData.longest_learning_streak > streakData.current_learning_streak && (
                  <p className="text-muted-foreground text-xs">
                    {t('personalBest', { count: streakData.longest_learning_streak })}
                  </p>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p>{t('tooltips.learning')}</p>
                {(streakData as any).last_learning_activity_date && (
                  <div className="text-xs font-extralight">
                    <p>
                      {t('tooltips.lastActivity')}: {getRelativeTime((streakData as any).last_learning_activity_date)}
                    </p>
                    <p>{formatLastActivityDate((streakData as any).last_learning_activity_date)}</p>
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>

          {/* Streak Tips */}
          <div className="bg-muted/50 rounded-lg p-3">
            <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold">
              <Trophy className="h-4 w-4" />
              {t('tips.title')}
            </h4>
            <ul className="text-muted-foreground space-y-1 text-xs">
              <li>• {t('tips.dailyLoginBonus')}</li>
              <li>• {t('tips.unlockRewards')}</li>
              <li>• {t('tips.consistency')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
