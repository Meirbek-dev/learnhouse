'use client';

import type { UserGamificationProfile } from '@/types/gamification';
import { useFormatter, useTranslations } from 'next-intl';
import { getLevelInfo } from '@/lib/gamification/levels';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ---------------------
// 1. LEVEL BADGE (Simple)
// ---------------------
export function LevelBadge({
  level,
  size = 'md',
  showIcon = true,
  className,
}: {
  level: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');
  const levelInfo = getLevelInfo(level, t);
  const Icon = levelInfo.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <Badge
      className={cn(levelInfo.color, sizeClasses[size], 'flex items-center gap-1 text-primary-foreground', className)}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {t('levelIndicators.level')} {level}
    </Badge>
  );
}

// ---------------------
// 2. LEVEL PROGRESS (Flexible)
// ---------------------
export function LevelProgress({
  profile,
  variant = 'bar',
  showLabels = true,
  animated = true,
  className,
}: {
  profile: UserGamificationProfile;
  variant?: 'bar' | 'compact';
  showLabels?: boolean;
  animated?: boolean;
  className?: string;
}) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');
  const format = useFormatter();
  const levelInfo = getLevelInfo(profile.level, t);

  const progressPercent = profile.level_progress_percent ?? 0;
  const xpToNext = profile.xp_to_next_level ?? 0;

  if (variant === 'compact') {
    return (
      <div className={cn('space-y-1', className)}>
        <Progress
          value={progressPercent}
          className={cn('h-1.5', animated && 'transition-all duration-500 ease-out')}
        />
        {showLabels && (
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>
              {t('levelIndicators.levelAbbrev')}
              {profile.level}
            </span>
            <span>
              {format.number(xpToNext)} {t('levelIndicators.xpToNext')}
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
          <span className={cn('font-medium', levelInfo.color)}>
            {t('levelIndicators.level')} {profile.level} - {levelInfo.title}
          </span>
          <span className="text-muted-foreground">
            {format.number(xpToNext)} {t('levelIndicators.xpToNext')}
          </span>
        </div>
      )}

      <div className="relative">
        <Progress
          value={progressPercent}
          className={cn('h-3', animated && 'transition-all duration-500 ease-out')}
        />

        {/* Level icon overlay */}
        <div className={cn('absolute top-0 left-2 flex h-full items-center', levelInfo.color)}>
          {(() => {
            const Icon = levelInfo.icon;
            return Icon ? <Icon className="h-3 w-3" /> : null;
          })()}
        </div>
      </div>

      {showLabels && (
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>{format.number(profile.total_xp)} XP</span>
          <span>{Math.round(progressPercent)}%</span>
          <span>{format.number(profile.total_xp + xpToNext)} XP</span>
        </div>
      )}
    </div>
  );
}

// ---------------------
// 3. LEVEL UP ANIMATION (Unchanged)
// ---------------------
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
