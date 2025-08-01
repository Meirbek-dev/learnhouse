'use client';

import { ExperienceBar, LevelIndicator, UnlockedFeatures } from '@components/Objects/GamificationLevel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { getGamificationProfile } from '@services/gamification/gamification';
import { Flame, Target, TrendingUp, Trophy, Zap } from 'lucide-react';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import { Progress } from '@components/ui/progress';
import { Badge } from '@components/ui/badge';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import useSWR from 'swr';

interface GamificationProfileWidgetProps {
  className?: string;
  variant?: 'full' | 'compact' | 'minimal';
  showTabs?: boolean;
}

interface StreakIndicatorProps {
  type: 'login' | 'learning';
  current: number;
  longest: number;
  lastActivity: string | null;
  className?: string;
  t: any; // Translation function
}

function StreakIndicator({ type, current, longest, lastActivity, className, t }: StreakIndicatorProps) {
  const isAtRisk = () => {
    if (!lastActivity) return false;
    const lastDate = new Date(lastActivity);
    const today = new Date();
    const diffDays = Math.ceil((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 1;
  };

  const getStreakColor = () => {
    if (current === 0) return 'text-muted-foreground';
    if (isAtRisk()) return 'text-orange-500';
    if (current >= 30) return 'text-purple-500';
    if (current >= 7) return 'text-blue-500';
    return 'text-green-500';
  };

  const getStreakStatus = () => {
    if (current === 0) return t(`streaks.${type}.none`);
    if (isAtRisk()) return t(`streaks.${type}.atRisk`);
    return t(`streaks.${type}.active`);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className={cn('h-4 w-4', getStreakColor())} />
          <span className="font-medium">{t(`streaks.${type}.title`)}</span>
        </div>
        <Badge variant={isAtRisk() ? 'destructive' : current > 0 ? 'default' : 'secondary'}>{getStreakStatus()}</Badge>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className={cn('font-bold text-lg', getStreakColor())}>
          {current} {t('streaks.days')}
        </span>
        <span className="text-muted-foreground">
          {t('streaks.best')}: {longest}
        </span>
      </div>

      {current > 0 && (
        <Progress
          value={Math.min((current / Math.max(longest, current)) * 100, 100)}
          className="h-2"
        />
      )}
    </div>
  );
}

interface StatsCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

function StatsCard({ icon: Icon, title, value, subtitle, trend, className }: StatsCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
            <Icon className="text-primary h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-muted-foreground text-sm font-medium">{title}</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{value}</p>
              {trend && trend !== 'neutral' && (
                <TrendingUp
                  className={cn(
                    'h-4 w-4',
                    trend === 'up' ? 'text-green-500' : 'text-red-500',
                    trend === 'down' && 'rotate-180',
                  )}
                />
              )}
            </div>
            {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function GamificationProfileWidget({
  className,
  variant = 'full',
  showTabs = true,
}: GamificationProfileWidgetProps) {
  const t = useTranslations('DashPage.Gamification');
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;

  const {
    data: gamificationProfile,
    error,
    isLoading,
  } = useSWR(
    org?.id && access_token ? [org.id, access_token] : null,
    ([orgId, token]) => getGamificationProfile(orgId, token),
    {
      refreshInterval: 30_000, // Refresh every 30 seconds
      revalidateOnFocus: true,
    },
  );

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-muted h-4 animate-pulse rounded" />
            <div className="bg-muted h-8 animate-pulse rounded" />
            <div className="bg-muted h-4 animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !gamificationProfile) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t('error.loadFailed')}</p>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'minimal') {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <LevelIndicator
              profile={gamificationProfile}
              variant="compact"
              showXP={false}
              showProgress={false}
            />
            <div className="text-right">
              <div className="text-sm font-medium">{gamificationProfile.total_xp.toLocaleString()} XP</div>
              <div className="text-muted-foreground text-xs">
                {t('rank')}: #{gamificationProfile.profile_data?.rank || '?'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'compact') {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <LevelIndicator
            profile={gamificationProfile}
            variant="full"
          />

          <div className="grid grid-cols-2 gap-3">
            <StreakIndicator
              type="login"
              current={gamificationProfile.current_login_streak}
              longest={gamificationProfile.longest_login_streak}
              lastActivity={gamificationProfile.last_login_date}
              t={t}
            />
            <StreakIndicator
              type="learning"
              current={gamificationProfile.current_learning_streak}
              longest={gamificationProfile.longest_learning_streak}
              lastActivity={gamificationProfile.last_learning_activity_date}
              t={t}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {showTabs ? (
          <Tabs
            defaultValue="overview"
            className="space-y-4"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">{t('tabs.overview')}</TabsTrigger>
              <TabsTrigger value="streaks">{t('tabs.streaks')}</TabsTrigger>
              <TabsTrigger value="progress">{t('tabs.progress')}</TabsTrigger>
            </TabsList>

            <TabsContent
              value="overview"
              className="space-y-4"
            >
              <LevelIndicator
                profile={gamificationProfile}
                variant="full"
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <StatsCard
                  icon={Zap}
                  title={t('stats.totalXP')}
                  value={gamificationProfile.total_xp.toLocaleString()}
                  subtitle={t('stats.allTime')}
                />
                <StatsCard
                  icon={Target}
                  title={t('stats.currentLevel')}
                  value={gamificationProfile.current_level}
                  subtitle={`${gamificationProfile.xp_to_next_level} XP ${t('stats.toNext')}`}
                />
              </div>
            </TabsContent>

            <TabsContent
              value="streaks"
              className="space-y-4"
            >
              <StreakIndicator
                type="login"
                current={gamificationProfile.current_login_streak}
                longest={gamificationProfile.longest_login_streak}
                lastActivity={gamificationProfile.last_login_date}
                t={t}
              />
              <StreakIndicator
                type="learning"
                current={gamificationProfile.current_learning_streak}
                longest={gamificationProfile.longest_learning_streak}
                lastActivity={gamificationProfile.last_learning_activity_date}
                t={t}
              />
            </TabsContent>

            <TabsContent
              value="progress"
              className="space-y-4"
            >
              <ExperienceBar
                profile={gamificationProfile}
                animated
              />
              <UnlockedFeatures level={gamificationProfile.current_level} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-6">
            <LevelIndicator
              profile={gamificationProfile}
              variant="full"
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <StreakIndicator
                type="login"
                current={gamificationProfile.current_login_streak}
                longest={gamificationProfile.longest_login_streak}
                lastActivity={gamificationProfile.last_login_date}
                t={t}
              />
              <StreakIndicator
                type="learning"
                current={gamificationProfile.current_learning_streak}
                longest={gamificationProfile.longest_learning_streak}
                lastActivity={gamificationProfile.last_learning_activity_date}
                t={t}
              />
            </div>

            <UnlockedFeatures level={gamificationProfile.current_level} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
