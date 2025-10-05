'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LevelBadge, LevelProgress } from './level-indicators';
import GamifiedUserAvatar from '@/components/Objects/GamifiedUserAvatar';
import type { UserGamificationProfile } from '@/types/gamification';
import { Activity, Flame } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';

interface ProfileCardProps {
  profile: UserGamificationProfile | null;
  isLoading?: boolean;
}

export function ProfileCard({ profile, isLoading }: ProfileCardProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-3 w-full" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-4 text-center">{t('dashboard.noData')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{t('dashboard.title')}</span>
          <LevelBadge level={profile.level} size="md" showIcon />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-4">
          <GamifiedUserAvatar
            size="2xl"
            gamificationProfile={profile}
            showLevelBadge
            use_with_session
            className="shrink-0"
          />
          <div className="flex-1 space-y-3">
            {/* XP Display */}
            <div className="flex items-center justify-between text-sm">
              <div>
                <div className="font-semibold">{profile.total_xp.toLocaleString()} XP</div>
                <div className="text-muted-foreground text-xs">
                  {(profile as any).xp_to_next_level?.toLocaleString() || 0} {t('levelIndicators.xpToNext')}
                </div>
              </div>
            </div>

            {/* Level Progress */}
            <LevelProgress profile={profile} variant="compact" showLabels={false} animated />

            {/* Quick Streaks */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                <span>
                  {t('streaks.login.title')}: {profile.login_streak || 0}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-500" />
                <span>
                  {t('streaks.learning.title')}: {profile.learning_streak || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
