'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { UserGamificationProfile } from '@/types/gamification';
import { Activity, CheckCircle2, Award, Flame } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslations } from 'next-intl';

interface QuickStatsCardProps {
  profile: UserGamificationProfile | null;
  isLoading?: boolean;
}

export function QuickStatsCard({ profile, isLoading }: QuickStatsCardProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.quickStats')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="space-y-2"
              >
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.quickStats')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-4 text-center">{t('dashboard.noData')}</p>
        </CardContent>
      </Card>
    );
  }

  const stats = [
    {
      icon: Activity,
      label: t('stats.activitiesCompleted'),
      value: profile.total_activities_completed || 0,
      color: 'text-blue-500',
    },
    {
      icon: CheckCircle2,
      label: t('stats.coursesCompleted'),
      value: profile.total_courses_completed || 0,
      color: 'text-green-500',
    },
    {
      icon: Award,
      label: t('stats.totalXP'),
      value: profile.total_xp || 0,
      color: 'text-purple-500',
    },
    {
      icon: Flame,
      label: t('stats.currentStreak'),
      value: Math.max(profile.login_streak || 0, profile.learning_streak || 0),
      color: 'text-orange-500',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.quickStats')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="flex items-center gap-3"
              >
                <Icon className={`h-5 w-5 shrink-0 ${stat.color}`} />
                <div>
                  <div className="text-muted-foreground text-xs">{stat.label}</div>
                  <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
