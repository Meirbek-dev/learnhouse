'use client';

import { Activity, Award, Crown, Flame, MoreHorizontal, Star, Target, Trophy, Zap } from 'lucide-react';
import { AVATAR_UNLOCKS, LevelIndicator, getLevelInfo } from '@/components/Objects/GamificationLevel';
import type { GamificationProfile } from '@/services/gamification/gamification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getGamificationProfile } from '@/services/gamification/gamification';
import GamifiedUserAvatar from '@/components/Objects/GamifiedUserAvatar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface GamificationProfileSectionProps {
  orgId: number;
  userId?: number;
  className?: string;
  variant?: 'full' | 'compact';
  showUnlocks?: boolean;
  showAchievements?: boolean;
}

export function GamificationProfileSection({
  orgId,
  userId,
  className,
  variant = 'full',
  showUnlocks = true,
  showAchievements = true,
}: GamificationProfileSectionProps) {
  const { data: session } = useSession();
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.tokens?.access_token) {
        setIsLoading(false);
        return;
      }

      try {
        const gamificationData = await getGamificationProfile(orgId, session.tokens.access_token);
        setProfile(gamificationData);
      } catch (error) {
        console.error('Error fetching gamification profile:', error);
        setError(t('dashboard.failedToLoad'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [orgId, session?.tokens?.access_token, t]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {t('dashboard.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-muted h-4 animate-pulse rounded" />
            <div className="bg-muted h-20 animate-pulse rounded" />
            <div className="bg-muted h-16 animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !profile) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {t('dashboard.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-4 text-center">{error || t('dashboard.noData')}</p>
        </CardContent>
      </Card>
    );
  }

  const levelInfo = getLevelInfo(profile.current_level, t);
  const nextMilestone = getNextMilestone(profile.current_level);
  const unlockedFrames = AVATAR_UNLOCKS.frames.filter((f) => profile.current_level >= f.level);
  const unlockedAccessories = AVATAR_UNLOCKS.accessories.filter((a) => profile.current_level >= a.level);
  const localizeLevelTitle = (raw: string) => {
    const key = raw.toLowerCase();
    try {
      return t(`levels.titles.${key}`);
    } catch {
      return raw; // fallback if missing
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {t('dashboard.title')}
          </div>
          <Badge
            variant="outline"
            className={cn('flex items-center gap-1', levelInfo.color)}
          >
            <levelInfo.icon className="h-3 w-3" />
            {levelInfo.title}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar and Level Info */}
        <div className="flex items-start gap-4">
          <GamifiedUserAvatar
            size="2xl"
            gamificationProfile={profile}
            showLevelBadge
            showAvatarFrame
            showAvatarAccessories
            use_with_session
            className="shrink-0"
          />
          <div className="flex-1 space-y-3">
            <LevelIndicator
              profile={profile}
              variant="full"
              showXP
              showProgress
            />

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                <span>
                  {t('streaks.login.title')}: {profile.current_login_streak} {t('streaks.days')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-500" />
                <span>
                  {t('streaks.learning.title')}: {profile.current_learning_streak} {t('streaks.days')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Next Milestone */}
        {nextMilestone && (
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 text-sm font-medium">
              <Target className="h-4 w-4" />
              {t('dashboard.nextMilestone')}
            </h4>
            <Card className="bg-muted/30">
              <CardContent className="">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <nextMilestone.icon className={cn('h-5 w-5', nextMilestone.color)} />
                    <div>
                      <p className="font-medium">
                        {t('levelIndicators.level')} {nextMilestone.level}
                      </p>
                      <p className="text-muted-foreground text-sm">{localizeLevelTitle(nextMilestone.title)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground text-sm">
                      {nextMilestone.minXP - profile.total_xp} {t('levelIndicators.xpToNext')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Unlocked Features */}
        {showUnlocks && (
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-medium">
              <Award className="h-4 w-4" />
              {t('dashboard.unlockedCustomizations')}
            </h4>

            <div className="grid grid-cols-1 gap-3">
              {/* Avatar Frames */}
              {unlockedFrames.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium">
                    {t('avatarCustomization.avatarFrames')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {unlockedFrames.map((frame) => (
                      <Badge
                        key={frame.id}
                        variant="secondary"
                        className="text-xs"
                      >
                        {frame.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Avatar Accessories */}
              {unlockedAccessories.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2 text-xs font-medium">
                    {t('avatarCustomization.avatarAccessories')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {unlockedAccessories.map((accessory) => (
                      <Badge
                        key={accessory.id}
                        variant="secondary"
                        className="flex items-center gap-1 text-xs"
                      >
                        <span>{accessory.icon}</span>
                        {accessory.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Achievements Preview */}
        {showAchievements && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-medium">
                <Star className="h-4 w-4" />
                {t('dashboard.recentAchievements')}
              </h4>
              <Button
                variant="ghost"
                size="sm"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {/* Example achievements - replace with real data */}
              {profile.current_login_streak >= 7 && (
                <div className="bg-muted/30 flex items-center gap-3 rounded-lg p-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100">
                    <Flame className="h-4 w-4 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t('dashboard.achievements.weekWarrior')}</p>
                    <p className="text-muted-foreground text-xs">{t('dashboard.achievements.weekWarriorDesc')}</p>
                  </div>
                </div>
              )}

              {profile.current_level >= 10 && (
                <div className="bg-muted/30 flex items-center gap-3 rounded-lg p-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
                    <Crown className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t('dashboard.achievements.scholar')}</p>
                    <p className="text-muted-foreground text-xs">
                      {t('dashboard.achievements.reachedLevel', { level: 10 })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper function to get next milestone
function getNextMilestone(currentLevel: number) {
  const milestones = [
    { level: 5, title: 'Apprentice', color: 'text-blue-500', icon: Star, minXP: 1000 },
    { level: 10, title: 'Scholar', color: 'text-purple-500', icon: Zap, minXP: 3000 },
    { level: 15, title: 'Expert', color: 'text-green-500', icon: Trophy, minXP: 6000 },
    { level: 25, title: 'Master', color: 'text-orange-500', icon: Crown, minXP: 12_000 },
    { level: 50, title: 'Grandmaster', color: 'text-red-500', icon: Crown, minXP: 30_000 },
  ];

  return milestones.find((milestone) => currentLevel < milestone.level);
}
