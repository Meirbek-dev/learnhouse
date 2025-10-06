'use client';

import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Flame, Zap, Calendar } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { GlowingLevelBadge } from '@/lib/gamification';
import GamifiedUserAvatar from '@/components/Objects/GamifiedUserAvatar';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { UserGamificationProfile } from '@/types/gamification';
import { cn } from '@/lib/utils';

interface HeroSectionProps {
  profile: UserGamificationProfile;
  userRank?: number | null;
  className?: string;
}

/**
 * Unified Hero Section - Consolidates profile + quick stats
 *
 * Key improvements:
 * - Single focused view with avatar, level, and progress
 * - Visual daily XP progress with cap indicator
 * - Prominent streak display with animation
 * - Next milestone preview
 */
export function HeroSection({ profile, userRank, className }: HeroSectionProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');

  const { xpToNext, xpProgress, dailyXpProgress, nextMilestone, streakStatus } = useMemo(() => {
    const xpForNext = Math.max(0, profile.xp_to_next_level || 0);
    const currentLevelXp = profile.xp_in_current_level || 0;
    const progress = xpForNext > 0 ? (currentLevelXp / (currentLevelXp + xpForNext)) * 100 : 0;

    // Daily XP progress (out of cap - hardcoded for now, will be added to backend)
    const dailyCap = 500;
    const dailyEarned = profile.daily_xp_earned || 0;
    const dailyProgress = Math.min((dailyEarned / dailyCap) * 100, 100);

    // Next milestone
    const nextLevel = [5, 10, 15, 25, 50, 100].find(l => l > profile.level);

    // Streak status
    const loginStreak = profile.login_streak || 0;
    const learningStreak = profile.learning_streak || 0;
    const maxStreak = Math.max(loginStreak, learningStreak);

    return {
      xpToNext: xpForNext,
      xpProgress: progress,
      dailyXpProgress: dailyProgress,
      nextMilestone: nextLevel,
      streakStatus: { login: loginStreak, learning: learningStreak, max: maxStreak },
    };
  }, [profile]);

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />

      <div className="relative p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
          {/* Left: Avatar & Level */}
          <div className="flex shrink-0 flex-col items-center gap-4">
            <div className="relative">
              <GamifiedUserAvatar
                size="3xl"
                gamificationProfile={profile}
                showLevelBadge={false}
                use_with_session
                className="ring-4 ring-background shadow-xl"
              />

              {/* Level badge - positioned on avatar */}
              <div className="absolute -bottom-2 -right-2">
                <GlowingLevelBadge
                  level={profile.level}
                  size="lg"
                  animated
                />
              </div>
            </div>

            {/* Streak indicators */}
            <div className="flex gap-2">
              <StreakBadge
                type="fire"
                value={streakStatus.login}
                label={t('streaks.loginStreak')}
              />
              <StreakBadge
                type="zap"
                value={streakStatus.learning}
                label={t('streaks.learningStreak')}
              />
            </div>
          </div>

          {/* Right: Stats & Progress */}
          <div className="flex-1 space-y-5">
            {/* Header */}
            <div>
              <h2 className="text-2xl font-bold">{t('profile.title')}</h2>
              <p className="text-muted-foreground text-sm">
                {t('levels.' + getLevelKey(profile.level))}
              </p>
            </div>

            {/* Level Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('progress.levelProgress')}</span>
                <span className="font-semibold">
                  Level {profile.level} → {profile.level + 1}
                </span>
              </div>
              <div className="relative">
                <Progress
                  value={xpProgress}
                  className="h-3"
                />
                {/* XP labels */}
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>{profile.xp_in_current_level?.toLocaleString() || 0} XP</span>
                  <span>{xpToNext.toLocaleString()} XP to go</span>
                </div>
              </div>
            </div>

            {/* Daily XP Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" />
                  {t('progress.dailyXP')}
                </span>
                <span className={cn(
                  'font-semibold',
                  dailyXpProgress >= 100 && 'text-orange-500'
                )}>
                  {profile.daily_xp_earned?.toLocaleString() || 0} / 500
                </span>
              </div>
              <Progress
                value={dailyXpProgress}
                className="h-2"
              />
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-4 pt-2">
              <StatCard
                icon={Trophy}
                label={t('stats.totalXP')}
                value={profile.total_xp?.toLocaleString() || '0'}
                iconColor="text-yellow-500"
              />
              <StatCard
                icon={TrendingUp}
                label={t('stats.rank')}
                value={userRank ? `#${userRank}` : '-'}
                iconColor="text-blue-500"
              />
              <StatCard
                icon={Calendar}
                label={t('stats.nextMilestone')}
                value={nextMilestone ? `Lvl ${nextMilestone}` : t('stats.maxLevel')}
                iconColor="text-purple-500"
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Animated Streak Badge
 */
function StreakBadge({
  type,
  value,
  label
}: {
  type: 'fire' | 'zap';
  value: number;
  label: string
}) {
  const Icon = type === 'fire' ? Flame : Zap;
  const baseColor = type === 'fire' ? 'text-orange-500' : 'text-yellow-500';
  const glowColor = type === 'fire' ? 'shadow-orange-500/50' : 'shadow-yellow-500/50';

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className="relative"
      title={label}
    >
      <Badge
        variant="secondary"
        className={cn(
          'gap-1 px-3 py-1.5',
          value > 0 && 'shadow-lg',
          value > 0 && glowColor
        )}
      >
        <Icon
          className={cn(
            'h-4 w-4',
            value > 0 ? baseColor : 'text-muted-foreground'
          )}
        />
        <span className="font-bold">{value}</span>
      </Badge>

      {/* Animated glow for active streaks */}
      {value > 3 && (
        <motion.div
          className={cn(
            'absolute inset-0 rounded-full blur-md',
            type === 'fire' ? 'bg-orange-500/30' : 'bg-yellow-500/30'
          )}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </motion.div>
  );
}

/**
 * Compact Stat Card
 */
function StatCard({
  icon: Icon,
  label,
  value,
  iconColor,
}: {
  icon: any;
  label: string;
  value: string;
  iconColor?: string;
}) {
  return (
    <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-center">
      <Icon className={cn('mx-auto h-5 w-5', iconColor)} />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

/**
 * Helper to get level title key
 */
function getLevelKey(level: number): string {
  if (level >= 50) return 'grandmaster';
  if (level >= 25) return 'master';
  if (level >= 15) return 'expert';
  if (level >= 10) return 'scholar';
  if (level >= 5) return 'apprentice';
  return 'novice';
}
