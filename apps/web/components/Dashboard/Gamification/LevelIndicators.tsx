'use client';

import type { UserGamificationProfile } from '@/types/gamification';
import { useFormatter, useTranslations } from 'next-intl';
import { getLevelInfo } from '@/lib/gamification/levels';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LevelProgressBarProps {
  profile: UserGamificationProfile;
  variant?: 'default' | 'compact';
  showLabels?: boolean;
  animated?: boolean;
  className?: string;
}

interface LevelDisplayProps {
  profile: UserGamificationProfile;
  variant?: 'full' | 'compact' | 'badge';
  showProgress?: boolean;
  showXP?: boolean;
  className?: string;
}

export function LevelProgressBar({
  profile,
  variant = 'default',
  showLabels = true,
  animated = true,
  className,
}: LevelProgressBarProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');
  const format = useFormatter();
  const levelInfo = getLevelInfo(profile.level, t);
  // Server-provided values are authoritative
  const progressPercentage = (profile as any).level_progress_percent ?? 0;
  const xpToNext = (profile as any).xp_to_next_level ?? 0;

  if (variant === 'compact') {
    return (
      <div className={cn('space-y-1', className)}>
        <Progress
          value={progressPercentage}
          className={cn('h-1.5', animated && 'transition-all duration-500 ease-out')}
        />
        {showLabels && (
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>
              {t('levelIndicators.levelAbbrev')}
              {profile.level}
            </span>
            <span>
              {xpToNext} {t('levelIndicators.xpToNext')}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {showLabels && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {t('levelIndicators.level')} {profile.level}
          </span>
          <span className="text-muted-foreground">{t('levelIndicators.xpToLevel', { level: profile.level + 1 })}</span>
        </div>
      )}

      <div className="relative">
        <Progress
          value={progressPercentage}
          className={cn('h-3', animated && 'transition-all duration-500 ease-out')}
        />

        {/* Level icon overlay */}
        <div className={cn('absolute top-0 left-2 flex h-full items-center', levelInfo.color)}>
          {(() => {
            const Icon = (levelInfo as any)?.icon;
            return Icon ? <Icon className="h-3 w-3" /> : null;
          })()}
        </div>
      </div>

      {showLabels && (
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>{t('levelIndicators.totalXp', { total: format.number(profile.total_xp) })}</span>
          <span>{t('levelIndicators.progress', { percentage: format.number(Math.round(progressPercentage)) })}</span>
          <span>{t('levelIndicators.totalXp', { total: format.number(profile.total_xp + xpToNext) })}</span>
        </div>
      )}
    </div>
  );
}

export function LevelDisplay({
  profile,
  variant = 'full',
  showProgress = true,
  showXP = true,
  className,
}: LevelDisplayProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');
  const format = useFormatter();
  const levelInfo = getLevelInfo(profile.level, t);
  const xpToNext = (profile as any).xp_to_next_level ?? 0;
  const Icon = levelInfo.icon;

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className={cn('flex items-center gap-2', levelInfo.color)}>
          <Icon className="h-5 w-5" />
          <div>
            <span className="font-semibold">
              {t('levelIndicators.levelAbbrev')}
              {profile.level}
            </span>
            <span className="ml-2 text-sm font-medium">{levelInfo.title}</span>
          </div>
        </div>
        {showXP && (
          <div className="text-right">
            <div className="text-sm font-medium">
              {t('levelIndicators.totalXp', { total: format.number(profile.total_xp) })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div className={cn('flex items-center gap-2', levelInfo.color)}>
          <Icon className="h-6 w-6" />
          <div>
            <span className="text-lg font-bold">
              {t('levelIndicators.level')} {profile.level}
            </span>
            <span className="ml-2 text-base font-medium">{levelInfo.title}</span>
          </div>
        </div>
        {showXP && (
          <div className="text-right">
            <div className="text-base font-semibold">
              {t('levelIndicators.totalXp', { total: format.number(profile.total_xp) })}
            </div>
            <div className="text-muted-foreground text-sm">
              {t('levelIndicators.xpToNextLevel', { xp: format.number(xpToNext) })}
            </div>
          </div>
        )}
      </div>

      {showProgress && (
        <LevelProgressBar
          profile={profile}
          showLabels
          animated
        />
      )}
    </div>
  );
}

// Animation components for level up effects
export function LevelUpAnimation({ newLevel, onComplete }: { newLevel: number; onComplete?: () => void }) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');
  const levelInfo = getLevelInfo(newLevel, t);
  const Icon = levelInfo.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative">
        {/* Glow effect */}
        <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 opacity-50 blur-xl" />

        {/* Main content */}
        <div className="border-border bg-background relative rounded-lg border p-8 text-center shadow-2xl">
          <div className={cn('mb-4 flex justify-center', levelInfo.color)}>
            <Icon className="h-16 w-16 animate-bounce" />
          </div>

          <h2 className="mb-2 text-3xl font-bold">{t('levelUpNotification.title')}</h2>
          <p className="mb-4 text-xl">
            <span className={cn('font-bold', levelInfo.color)}>
              {t('levelIndicators.level')} {newLevel} - {levelInfo.title}
            </span>
          </p>

          {levelInfo.unlocks && levelInfo.unlocks.length > 0 && (
            <div className="mb-6">
              <p className="text-muted-foreground mb-2 text-sm">{t('levelUpNotification.newUnlocks')}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {levelInfo.unlocks.map((unlock, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                  >
                    {unlock}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onComplete}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-6 py-2 font-medium transition-colors"
          >
            {t('levelUpNotification.continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
