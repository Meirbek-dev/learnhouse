'use client';

import { type GamificationProfile, calculateLevelProgress } from '@services/gamification/gamification';
import { Crown, Star, Target, Trophy, Zap } from 'lucide-react';
import { Progress } from '@components/ui/progress';
import { Badge } from '@components/ui/badge';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export interface LevelInfo {
  level: number;
  title: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  minXP: number;
  unlocks?: string[];
}

// Level configuration with RPG-style progression
export const LEVEL_CONFIG: Record<number, LevelInfo> = {
  1: { level: 1, title: 'Novice', color: 'text-gray-500', icon: Target, minXP: 0, unlocks: ['Basic Profile'] },
  5: { level: 5, title: 'Apprentice', color: 'text-blue-500', icon: Star, minXP: 1000, unlocks: ['Avatar Frames'] },
  10: { level: 10, title: 'Scholar', color: 'text-purple-500', icon: Zap, minXP: 3000, unlocks: ['Custom Avatar Hat'] },
  15: {
    level: 15,
    title: 'Expert',
    color: 'text-green-500',
    icon: Trophy,
    minXP: 6000,
    unlocks: ['Avatar Accessories'],
  },
  25: {
    level: 25,
    title: 'Master',
    color: 'text-orange-500',
    icon: Crown,
    minXP: 12_000,
    unlocks: ['Exclusive Themes'],
  },
  50: {
    level: 50,
    title: 'Grandmaster',
    color: 'text-red-500',
    icon: Crown,
    minXP: 30_000,
    unlocks: ['Legendary Status'],
  },
};

// Avatar customization unlocks
export const AVATAR_UNLOCKS = {
  frames: [
    { id: 'golden', level: 5, name: 'Golden Frame', color: 'border-yellow-400' },
    { id: 'silver', level: 8, name: 'Silver Frame', color: 'border-gray-400' },
    { id: 'diamond', level: 15, name: 'Diamond Frame', color: 'border-blue-400' },
    { id: 'legendary', level: 25, name: 'Legendary Frame', color: 'border-purple-500' },
  ],
  accessories: [
    { id: 'wizard_hat', level: 10, name: 'Wizard Hat', icon: '🎩' },
    { id: 'crown', level: 20, name: 'Scholar Crown', icon: '👑' },
    { id: 'glasses', level: 15, name: 'Smart Glasses', icon: '🤓' },
    { id: 'cape', level: 30, name: 'Knowledge Cape', icon: '🦸' },
  ],
};

interface LevelIndicatorProps {
  profile: GamificationProfile;
  variant?: 'compact' | 'full' | 'badge';
  showXP?: boolean;
  showProgress?: boolean;
  className?: string;
}

export function getLevelInfo(level: number, t?: any): LevelInfo {
  // Find the highest level config that the user has reached
  const availableLevels = Object.keys(LEVEL_CONFIG)
    .map(Number)
    .sort((a, b) => b - a);
  const currentLevelConfig = availableLevels.find((configLevel) => level >= configLevel) || 1;
  const baseConfig = LEVEL_CONFIG[currentLevelConfig]!;

  // Get translated title if t function is provided
  const titleMap: Record<string, string> = {
    Novice: t ? t('Gamification.levels.titles.novice') : 'Novice',
    Apprentice: t ? t('Gamification.levels.titles.apprentice') : 'Apprentice',
    Scholar: t ? t('Gamification.levels.titles.scholar') : 'Scholar',
    Expert: t ? t('Gamification.levels.titles.expert') : 'Expert',
    Master: t ? t('Gamification.levels.titles.master') : 'Master',
    Grandmaster: t ? t('Gamification.levels.titles.grandmaster') : 'Grandmaster',
  };

  return {
    ...baseConfig,
    level: level, // Override with actual level
    title: titleMap[baseConfig.title] || baseConfig.title,
  };
}

export function getUnlockedFeatures(level: number, t?: any): string[] {
  const unlocked: string[] = [];

  // Get translated unlock names
  const unlockMap: Record<string, string> = {
    'Basic Profile': t ? t('Gamification.levels.unlocks.basicProfile') : 'Basic Profile',
    'Avatar Frames': t ? t('Gamification.levels.unlocks.avatarFrames') : 'Avatar Frames',
    'Custom Avatar Hat': t ? t('Gamification.levels.unlocks.customAvatarHat') : 'Custom Avatar Hat',
    'Avatar Accessories': t ? t('Gamification.levels.unlocks.avatarAccessories') : 'Avatar Accessories',
    'Exclusive Themes': t ? t('Gamification.levels.unlocks.exclusiveThemes') : 'Exclusive Themes',
    'Legendary Status': t ? t('Gamification.levels.unlocks.legendaryStatus') : 'Legendary Status',
    'Golden Frame': t ? t('Gamification.avatar.frames.golden') : 'Golden Frame',
    'Silver Frame': t ? t('Gamification.avatar.frames.silver') : 'Silver Frame',
    'Diamond Frame': t ? t('Gamification.avatar.frames.diamond') : 'Diamond Frame',
    'Legendary Frame': t ? t('Gamification.avatar.frames.legendary') : 'Legendary Frame',
    'Wizard Hat': t ? t('Gamification.avatar.accessories.wizardHat') : 'Wizard Hat',
    'Scholar Crown': t ? t('Gamification.avatar.accessories.scholarCrown') : 'Scholar Crown',
    'Smart Glasses': t ? t('Gamification.avatar.accessories.smartGlasses') : 'Smart Glasses',
    'Knowledge Cape': t ? t('Gamification.avatar.accessories.knowledgeCape') : 'Knowledge Cape',
  };

  Object.values(LEVEL_CONFIG).forEach((config) => {
    if (level >= config.level && config.unlocks) {
      config.unlocks.forEach((unlock) => {
        const translatedUnlock = unlockMap[unlock] || unlock;
        unlocked.push(translatedUnlock);
      });
    }
  });

  // Add specific avatar unlocks
  AVATAR_UNLOCKS.frames.forEach((frame) => {
    if (level >= frame.level) {
      const translatedFrame = unlockMap[frame.name] || frame.name;
      unlocked.push(translatedFrame);
    }
  });

  AVATAR_UNLOCKS.accessories.forEach((accessory) => {
    if (level >= accessory.level) {
      const translatedAccessory = unlockMap[accessory.name] || accessory.name;
      unlocked.push(translatedAccessory);
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
          {t('Gamification.levels.progress.level')}.{profile.current_level}
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
            {t('Gamification.levels.progress.level')}.{profile.current_level}
          </span>
        </div>
        {showXP && <span className="text-muted-foreground text-sm">{profile.total_xp.toLocaleString()} XP</span>}
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
              {t('Gamification.levels.progress.level')} {profile.current_level}
            </span>
            <span className="ml-2 text-sm font-medium">{levelInfo.title}</span>
          </div>
        </div>
        {showXP && (
          <div className="text-right">
            <div className="text-sm font-medium">{profile.total_xp.toLocaleString()} XP</div>
            <div className="text-muted-foreground text-xs">
              {profile.xp_to_next_level} {t('Gamification.levels.progress.toNextLevel')}
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
              {t('Gamification.levels.progress.level')} {profile.current_level}
            </span>
            <span>{progressPercentage.toFixed(0)}%</span>
            <span>
              {t('Gamification.levels.progress.level')} {profile.current_level + 1}
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
  const progressPercentage = calculateLevelProgress(profile);
  const levelInfo = getLevelInfo(profile.current_level, t);

  return (
    <div className={cn('space-y-2', className)}>
      {showLabels && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {t('Gamification.levels.progress.level')} {profile.current_level}
          </span>
          <span className="text-muted-foreground">
            {profile.xp_to_next_level} XP {t('Gamification.levels.progress.toNextLevel')}
          </span>
        </div>
      )}

      <div className="relative">
        <Progress
          value={progressPercentage}
          className={cn('h-3', animated && 'transition-all duration-500 ease-out')}
        />

        {/* Level indicator overlay */}
        <div className={cn('absolute left-2 top-0 flex h-full items-center', levelInfo.color)}>
          <levelInfo.icon className="h-3 w-3" />
        </div>
      </div>

      {showLabels && (
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>{profile.total_xp.toLocaleString()} XP</span>
          <span>{(profile.total_xp + profile.xp_to_next_level).toLocaleString()} XP</span>
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
