'use client';

import type { GamificationProfile } from '@services/gamification/gamification';
import { calculateLevelProgress } from '@services/gamification/gamification';
import { Crown, Star, Target, Trophy, Zap } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Progress } from '@components/ui/progress';
import { Badge } from '@components/ui/badge';
import { cn } from '@/lib/utils';

export interface LevelInfo {
  level: number;
  title: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  minXP: number;
  unlocks?: string[];
}

// Level configuration with RPG-style progression (translation keys)
export const LEVEL_CONFIG: Record<number, LevelInfo> = {
  1: { level: 1, title: 'novice', color: 'text-gray-500', icon: Target, minXP: 0, unlocks: ['basicProfile'] },
  5: { level: 5, title: 'apprentice', color: 'text-blue-500', icon: Star, minXP: 1000, unlocks: ['avatarFrames'] },
  10: { level: 10, title: 'scholar', color: 'text-purple-500', icon: Zap, minXP: 3000, unlocks: ['customAvatarHat'] },
  15: {
    level: 15,
    title: 'expert',
    color: 'text-green-500',
    icon: Trophy,
    minXP: 6000,
    unlocks: ['avatarAccessories'],
  },
  25: {
    level: 25,
    title: 'master',
    color: 'text-orange-500',
    icon: Crown,
    minXP: 12_000,
    unlocks: ['exclusiveThemes'],
  },
  50: {
    level: 50,
    title: 'grandmaster',
    color: 'text-red-500',
    icon: Crown,
    minXP: 30_000,
    unlocks: ['legendaryStatus'],
  },
};

// Avatar customization unlocks (translation keys)
export const AVATAR_UNLOCKS = {
  frames: [
    { id: 'golden', level: 5, name: 'golden', color: 'border-yellow-400' },
    { id: 'silver', level: 8, name: 'silver', color: 'border-gray-400' },
    { id: 'diamond', level: 15, name: 'diamond', color: 'border-blue-400' },
    { id: 'legendary', level: 25, name: 'legendary', color: 'border-purple-500' },
  ],
  accessories: [
    { id: 'wizard_hat', level: 10, name: 'wizardHat', icon: '🎩' },
    { id: 'crown', level: 20, name: 'scholarCrown', icon: '👑' },
    { id: 'glasses', level: 15, name: 'smartGlasses', icon: '🤓' },
    { id: 'cape', level: 30, name: 'knowledgeCape', icon: '🦸' },
  ],
};

interface LevelIndicatorProps {
  profile: GamificationProfile;
  variant?: 'compact' | 'full' | 'badge';
  showXP?: boolean;
  showProgress?: boolean;
  className?: string;
}

export function getLevelInfo(level: number, t: any): LevelInfo {
  // Find the highest level config that the user has reached
  const availableLevels = Object.keys(LEVEL_CONFIG)
    .map(Number)
    .sort((a, b) => b - a);
  const currentLevelConfig = availableLevels.find((configLevel) => level >= configLevel) || 1;
  const baseConfig = LEVEL_CONFIG[currentLevelConfig]!;

  return {
    ...baseConfig,
    level: level, // Override with actual level
    title: t(`levels.titles.${baseConfig.title}`),
  };
}

export function getUnlockedFeatures(level: number, t: any): string[] {
  const unlocked: string[] = [];

  Object.values(LEVEL_CONFIG).forEach((config) => {
    if (level >= config.level && config.unlocks) {
      config.unlocks.forEach((unlock) => {
        unlocked.push(t(`Gamification.levels.unlocks.${unlock}`));
      });
    }
  });

  // Add specific avatar unlocks
  AVATAR_UNLOCKS.frames.forEach((frame) => {
    if (level >= frame.level) {
      unlocked.push(t(`Gamification.avatar.frames.${frame.name}`));
    }
  });

  AVATAR_UNLOCKS.accessories.forEach((accessory) => {
    if (level >= accessory.level) {
      unlocked.push(t(`Gamification.avatar.accessories.${accessory.name}`));
    }
  });

  return unlocked;
}

export function LevelIndicator({
  profile,
  variant = 'full',
  showXP = true,
  showProgress = true,
  className,
}: LevelIndicatorProps) {
  const t = useTranslations('DashPage.UserAccountSettings');
  const format = useFormatter();
  const levelInfo = getLevelInfo(profile.current_level, t);
  const progressPercentage = calculateLevelProgress(profile);
  const Icon = levelInfo.icon;

  if (variant === 'badge') {
    return (
      <Badge
        variant="outline"
        className={cn('flex items-center gap-1', levelInfo.color, className)}
      >
        <Icon className="h-3 w-3" />
        <span className="font-medium">
          {t('Gamification.levelIndicators.level')} {profile.current_level}
        </span>
      </Badge>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className={cn('flex items-center gap-1', levelInfo.color)}>
          <Icon className="h-4 w-4" />
          <span className="font-semibold">
            {t('Gamification.levelIndicators.level')} {profile.current_level}
          </span>
        </div>
        {showXP && <span className="text-muted-foreground text-sm">{format.number(profile.total_xp)} XP</span>}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <div className={cn('flex items-center gap-2', levelInfo.color)}>
          <Icon className="h-5 w-5" />
          <div>
            <span className="font-semibold">
              {t('Gamification.levelIndicators.level')} {profile.current_level}
            </span>
            <span className="ml-2 text-sm font-medium">{levelInfo.title}</span>
          </div>
        </div>
        {showXP && (
          <div className="text-right">
            <div className="text-sm font-medium">{format.number(profile.total_xp)} XP</div>
            <div className="text-muted-foreground text-xs">
              {profile.xp_to_next_level} {t('Gamification.levelIndicators.xpToNext')}
            </div>
          </div>
        )}
      </div>

      {showProgress && (
        <div className="space-y-1">
          <Progress
            value={progressPercentage}
            className="h-2"
          />
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>
              {t('Gamification.levelIndicators.level')} {profile.current_level}
            </span>
            <span>{progressPercentage.toFixed(0)}%</span>
            <span>
              {t('Gamification.levelIndicators.level')} {profile.current_level + 1}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

interface ExperienceBarProps {
  profile: GamificationProfile;
  animated?: boolean;
  showLabels?: boolean;
  className?: string;
}

export function ExperienceBar({ profile, animated = true, showLabels = true, className }: ExperienceBarProps) {
  const t = useTranslations('DashPage.UserAccountSettings');
  const format = useFormatter();
  const progressPercentage = calculateLevelProgress(profile);
  const levelInfo = getLevelInfo(profile.current_level, t);

  return (
    <div className={cn('space-y-2', className)}>
      {showLabels && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {t('Gamification.levelIndicators.level')} {profile.current_level}
          </span>
          <span className="text-muted-foreground">
            {profile.xp_to_next_level} XP {t('Gamification.levelIndicators.xpToNext')}
          </span>
        </div>
      )}

      <div className="relative">
        <Progress
          value={progressPercentage}
          className={cn('h-3', animated && 'transition-all duration-500 ease-out')}
        />

        {/* Level indicator overlay */}
        <div className={cn('absolute top-0 left-2 flex h-full items-center', levelInfo.color)}>
          <levelInfo.icon className="h-3 w-3" />
        </div>
      </div>

      {showLabels && (
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>{format.number(profile.total_xp)} XP</span>
          <span>{format.number(profile.total_xp + profile.xp_to_next_level)} XP</span>
        </div>
      )}
    </div>
  );
}

interface UnlockedFeaturesProps {
  level: number;
  className?: string;
}

export function UnlockedFeatures({ level, className }: UnlockedFeaturesProps) {
  const t = useTranslations('DashPage.UserAccountSettings');
  const unlockedFeatures = getUnlockedFeatures(level, t);

  if (unlockedFeatures.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      <h4 className="text-muted-foreground text-sm font-medium">{t('Gamification.avatar.unlockedFeatures')}</h4>
      <div className="flex flex-wrap gap-1">
        {unlockedFeatures.slice(0, 5).map((feature, index) => (
          <Badge
            key={index}
            variant="secondary"
            className="text-xs"
          >
            {feature}
          </Badge>
        ))}
        {unlockedFeatures.length > 5 && (
          <Badge
            variant="outline"
            className="text-xs"
          >
            +{unlockedFeatures.length - 5} {t('Gamification.avatar.featuresMore')}
          </Badge>
        )}
      </div>
    </div>
  );
}
