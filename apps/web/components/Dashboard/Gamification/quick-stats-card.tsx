'use client';

import { GamificationCard, LoadingState, EmptyState } from '@/lib/gamification';
import type { UserGamificationProfile } from '@/types/gamification';
import { Activity, Award, CheckCircle2, Flame } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface QuickStatsCardProps {
  profile: UserGamificationProfile | null;
  isLoading?: boolean;
}

export function QuickStatsCard({ profile, isLoading }: QuickStatsCardProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');

  if (isLoading) {
    return (
      <LoadingState
        title={t('dashboard.quickStats')}
        variant="stats"
      />
    );
  }

  if (!profile) {
    return (
      <EmptyState
        title={t('dashboard.quickStats')}
        message={t('dashboard.noData')}
        variant="info"
      />
    );
  }

  return (
    <GamificationCard
      title={t('dashboard.quickStats')}
      className="h-full"
    >
      <GamificationCard.Grid
        columns={2}
        gap="md"
      >
        <GamificationCard.Stat
          label={t('stats.activitiesCompleted')}
          value={profile.total_activities_completed || 0}
          icon={Activity}
          color="text-blue-500"
          animated
        />
        <GamificationCard.Stat
          label={t('stats.coursesCompleted')}
          value={profile.total_courses_completed || 0}
          icon={CheckCircle2}
          color="text-green-500"
          animated
        />
        <GamificationCard.Stat
          label={t('stats.totalXP')}
          value={profile.total_xp || 0}
          icon={Award}
          color="text-purple-500"
          animated
        />
        <GamificationCard.Stat
          label={t('stats.currentStreak')}
          value={Math.max(profile.login_streak || 0, profile.learning_streak || 0)}
          icon={Flame}
          color="text-orange-500"
          animated
        />
      </GamificationCard.Grid>
    </GamificationCard>
  );
}
