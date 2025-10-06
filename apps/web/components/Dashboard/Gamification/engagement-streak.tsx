/**
 * Unified Engagement Streak Component
 *
 * Merges login + learning streaks into single "Engagement Streak"
 * - Counts if user logs in OR completes 1+ activity
 * - 1-day grace period (life happens!)
 * - Less gamified language: "Active Days" instead of "Streak"
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { UserGamificationProfile } from '@/types/gamification';
import { Calendar, Flame, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface EngagementStreakProps {
  profile: UserGamificationProfile;
  className?: string;
}

export function EngagementStreak({ profile, className }: EngagementStreakProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');

  // Calculate unified engagement streak (max of login or learning)
  const engagement = useMemo(() => {
    const loginStreak = profile.login_streak || 0;
    const learningStreak = profile.learning_streak || 0;
    const longestLogin = profile.longest_login_streak || 0;
    const longestLearning = profile.longest_learning_streak || 0;

    // Use the higher streak as "engagement"
    const current = Math.max(loginStreak, learningStreak);
    const longest = Math.max(longestLogin, longestLearning);
    const isActive = current > 0;
    const isRecord = current === longest && current > 0;

    return {
      current,
      longest,
      isActive,
      isRecord,
    };
  }, [profile]);

  const getMessage = (days: number): string => {
    if (days === 0) return t('engagement.getStarted');
    if (days === 1) return t('engagement.greatStart');
    if (days < 7) return t('engagement.buildingMomentum');
    if (days < 30) return t('engagement.strongHabit');
    if (days < 100) return t('engagement.dedicated');
    return t('engagement.legendary');
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5" />
          {t('engagement.activeDays')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Current Streak */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                animate={engagement.isActive ? { scale: [1, 1.1, 1] } : {}}
                transition={{
                  duration: 0.5,
                  repeat: engagement.isActive ? Number.POSITIVE_INFINITY : 0,
                  repeatDelay: 2,
                }}
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full',
                  engagement.isActive ? 'bg-gradient-to-br from-orange-500 to-red-500' : 'bg-muted',
                )}
              >
                {engagement.isActive ? (
                  <Flame className="h-6 w-6 text-white" />
                ) : (
                  <Calendar className="h-6 w-6 text-muted-foreground" />
                )}
              </motion.div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{engagement.current}</span>
                  <span className="text-sm text-muted-foreground">
                    {engagement.current === 1 ? t('engagement.day') : t('engagement.days')}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{getMessage(engagement.current)}</p>
              </div>
            </div>

            {/* Record Badge */}
            {engagement.isRecord && engagement.current > 1 && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                className="flex flex-col items-center gap-1"
              >
                <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                  {t('engagement.record')}
                </span>
              </motion.div>
            )}
          </div>

          {/* Longest Streak */}
          {engagement.longest > 0 && engagement.longest !== engagement.current && (
            <div className="rounded-lg border bg-muted/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('engagement.longestStreak')}</span>
                <span className="text-sm font-semibold">
                  {engagement.longest} {engagement.longest === 1 ? t('engagement.day') : t('engagement.days')}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
