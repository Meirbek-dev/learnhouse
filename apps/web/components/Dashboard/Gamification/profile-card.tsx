'use client';

import {
  GamificationCard,
  LoadingState,
  EmptyState,
  GlowingLevelBadge,
  EnhancedLevelProgress,
} from '@/lib/gamification';
import GamifiedUserAvatar from '@/components/Objects/GamifiedUserAvatar';
import type { UserGamificationProfile } from '@/types/gamification';
import { Activity, Flame, User } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ProfileCardProps {
  profile: UserGamificationProfile | null;
  isLoading?: boolean;
}

export function ProfileCard({ profile, isLoading }: ProfileCardProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');

  if (isLoading) {
    return (
      <LoadingState
        title={t('dashboard.title')}
        variant="profile"
      />
    );
  }

  if (!profile) {
    return (
      <EmptyState
        title={t('dashboard.title')}
        message={t('dashboard.noData')}
        variant="info"
      />
    );
  }

  return (
    <GamificationCard>
      <GamificationCard.Header
        icon={User}
        title={t('dashboard.title')}
        badge={
          <GlowingLevelBadge
            level={profile.level}
            size="md"
            animated
          />
        }
      />
      <GamificationCard.Content>
        <div className="flex items-start gap-4">
          <GamifiedUserAvatar
            size="2xl"
            gamificationProfile={profile}
            showLevelBadge
            use_with_session
            className="shrink-0"
          />
          <div className="flex-1 space-y-4">
            {/* Enhanced Level Progress */}
            <EnhancedLevelProgress
              profile={profile}
              showMilestones
              animated
            />

            {/* XP Metrics */}
            <div className="space-y-2">
              <GamificationCard.MetricRow
                label={t('stats.totalXP')}
                value={profile.total_xp.toLocaleString()}
                sublabel={`${profile.xp_to_next_level?.toLocaleString() ?? 0} ${t('levelIndicators.xpToNext')}`}
                color="text-purple-500"
              />
              <GamificationCard.MetricRow
                label={t('streaks.login.title')}
                value={profile.login_streak || 0}
                icon={Flame}
                color="text-orange-500"
                trend={profile.login_streak > profile.longest_login_streak - 5 ? 'up' : 'neutral'}
              />
              <GamificationCard.MetricRow
                label={t('streaks.learning.title')}
                value={profile.learning_streak || 0}
                icon={Activity}
                color="text-green-500"
                trend={profile.learning_streak > profile.longest_learning_streak - 5 ? 'up' : 'neutral'}
              />
            </div>
          </div>
        </div>
      </GamificationCard.Content>
    </GamificationCard>
  );
}
