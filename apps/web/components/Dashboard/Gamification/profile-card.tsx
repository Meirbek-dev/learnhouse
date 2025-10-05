'use client';

import GamifiedUserAvatar from '@/components/Objects/GamifiedUserAvatar';
import type { UserGamificationProfile } from '@/types/gamification';
import { LevelBadge, LevelProgress } from './level-indicators';
import { Activity, Flame } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ProfileSkeleton } from './shared/loading-states';
import { EmptyProfile } from './shared/empty-states';
import { GamificationCard } from './shared/gamification-card';

interface ProfileCardProps {
  profile: UserGamificationProfile | null;
  isLoading?: boolean;
}

export function ProfileCard({ profile, isLoading }: ProfileCardProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');

  if (isLoading) return <ProfileSkeleton title={t('dashboard.title')} />;
  if (!profile) return <EmptyProfile title={t('dashboard.title')} message={t('dashboard.noData')} />;

  return (
    <GamificationCard
      title={t('dashboard.title')}
      headerAction={
        <LevelBadge
          level={profile.level}
          size="md"
          showIcon
        />
      }
    >
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
                {profile.xp_to_next_level?.toLocaleString() ?? 0} {t('levelIndicators.xpToNext')}
              </div>
            </div>
          </div>

          {/* Level Progress */}
          <LevelProgress
            profile={profile}
            variant="compact"
            showLabels={false}
            animated
          />

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
    </GamificationCard>
  );
}
