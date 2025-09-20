'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, Calendar, Flame, RefreshCw, Star, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useGamification } from '@/hooks/useGamification';
import { useProvideStreaks } from '@/hooks/useStreaks';
import { useCallback, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSession } from 'next-auth/react';

// Note: Profile shape comes from services/gamification. It uses UserGamificationProfile
// which has current_streak, longest_streak, and last_activity_date fields.
// Learning streaks are not currently tracked separately in the new profile structure.

interface StreakWidgetProps {
  orgId: number;
  className?: string;
}

export function StreakWidget({ orgId, className = '' }: StreakWidgetProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification.streakWidget');
  const locale = useLocale();
  const format = useFormatter();
  const { data: session } = useSession();
  const accessToken: string | undefined = (session as any)?.tokens?.access_token;
  const { profile, isLoading, error, refetch } = useGamification({
    orgId,
    accessToken,
    enabled: !!orgId && !!accessToken,
  });
  const { streaks } = useProvideStreaks(orgId, accessToken);
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
      // Use a safe translation wrapper to prevent runtime errors if a message key
      // expects placeholders we don't supply or next-intl encounters malformed ICU.
      const safeT = (key: string, values?: Record<string, unknown>) => {
        try {
          const res = t(key as any, values as any);
          // Ensure we always return a string
          if (typeof res === 'string') return res;
          if (res === null) return '';
          return String(res);
        } catch {
          // Fallback to empty string to avoid passing undefined into ICU
          return '';
        }
      };

      if (status === 'active' && streak > 0) {
        // Provide only count; translation now uses ICU plural rules.
        return safeT('streakMessages.active', { count: Number.isFinite(streak) ? streak : 0 });
      }

      if (status === 'at-risk') {
        const actionRaw =
          type === 'login' ? safeT('streakMessages.loginAction') : safeT('streakMessages.completeAction');
        const action = actionRaw || ''; // never undefined
        return safeT('streakMessages.atRisk', { action });
      }

      if (status === 'broken' || streak === 0) {
        const typeTextRaw = type === 'login' ? safeT('streakMessages.login') : safeT('streakMessages.learning');
        const typeText = typeTextRaw || '';
        return safeT('streakMessages.broken', { type: typeText });
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
        if (Number.isNaN(date.getTime())) {
          return t('tooltips.invalidDate');
        }
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
        if (Number.isNaN(date.getTime())) {
          return t('tooltips.invalidDate');
        }

        const now = new Date();
        const diffMs = date.getTime() - now.getTime();
        const absMs = Math.abs(diffMs);

        // Prefer days/hours granularity
        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;

        let value: number;
        let unit: Intl.RelativeTimeFormatUnit;

        if (absMs >= day) {
          value = Math.round(diffMs / day);
          unit = 'day';
        } else if (absMs >= hour) {
          value = Math.round(diffMs / hour);
          unit = 'hour';
        } else {
          value = Math.round(diffMs / minute);
          unit = 'minute';
        }

        let rel: string;
        try {
          const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
          rel = rtf.format(value, unit);
        } catch {
          // Very old browsers: simple fallback
          const suffix = value < 0 ? t('tooltips.ago') : t('tooltips.in');
          rel = `${Math.abs(value)} ${unit} ${suffix}`.trim();
        }
        return rel;
      } catch (error) {
        console.warn('Invalid date format in getRelativeTime:', dateString, error);
        return t('tooltips.invalidDate');
      }
    },
    [t],
  );

  // Localized day(s) using next-intl's plural rules. IMPORTANT: pass a raw number (not a formatted string)
  // so pluralization works and libraries don't attempt value.toString() on an undefined placeholder.
  const formatDays = useCallback(
    (count: number) => {
      const safeCount = Number.isFinite(count) ? count : 0;
      try {
        const result = t('days', { count: safeCount });
        if (typeof result === 'undefined' || result === null) {
          return `${safeCount}`;
        }
        return typeof result === 'string' ? result : String(result);
      } catch {
        // Fallback if translation or formatting fails
        return `${safeCount}`;
      }
    },
    [t],
  );

  const streakData = useMemo(() => {
    if (!profile) return null;
    try {
      // Basic sanity log in dev
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[StreakWidget] profile snapshot', {
          current_streak: (profile as any)?.current_streak,
          longest_streak: (profile as any)?.longest_streak,
          last_activity_date: (profile as any)?.last_activity_date,
        });
      }
    } catch {}

    // UserGamificationProfile has current_streak and longest_streak
    // We'll use current_streak for login streak and set learning streak to 0
    // Use the correct field names from the updated profile structure
    const loginCurrent = (streaks?.login ?? profile.login_streak) || 0;
    const loginLongest = (streaks?.maxLogin ?? profile.longest_login_streak) || 0;
    const learningCurrent = (streaks?.learning ?? profile.learning_streak) || 0;
    const learningLongest = (streaks?.maxLearning ?? profile.longest_learning_streak) || 0;

    const lastActivityDate = profile.last_login_date || profile.last_learning_date || null;

    return {
      loginStatus: getStreakStatus(lastActivityDate),
      learningStatus: 'none', // No learning streak data in new profile
      loginMessage: getStreakMessage(loginCurrent, getStreakStatus(lastActivityDate), 'login'),
      learningMessage: getStreakMessage(learningCurrent, 'none', 'learning'),
      current_login_streak: loginCurrent,
      longest_login_streak: loginLongest,
      current_learning_streak: learningCurrent,
      longest_learning_streak: learningLongest,
      last_login_date: lastActivityDate,
      last_learning_activity_date: null, // Not available in new profile
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
                    {formatDays(streakData?.current_login_streak || 0)}
                  </Badge>
                </div>

                <p className="text-muted-foreground mb-2 text-sm">{loginMessage}</p>

                {(streakData?.longest_login_streak || 0) > (streakData?.current_login_streak || 0) && (
                  <p className="text-muted-foreground text-xs">
                    {t('personalBest', { count: streakData?.longest_login_streak || 0 })}
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
                    {formatDays(streakData?.current_learning_streak || 0)}
                  </Badge>
                </div>

                <p className="text-muted-foreground mb-2 text-sm">{learningMessage}</p>

                {(streakData?.longest_learning_streak || 0) > (streakData?.current_learning_streak || 0) && (
                  <p className="text-muted-foreground text-xs">
                    {t('personalBest', { count: streakData?.longest_learning_streak || 0 })}
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
