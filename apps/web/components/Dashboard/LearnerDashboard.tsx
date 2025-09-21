'use client';

import {
  GamificationDashboard as ClientGamificationDashboard,
  Leaderboard as ClientLeaderboard,
  GamificationProfileSection,
  StreakWidget,
} from '@/components/Dashboard/Gamification';
import { getGamificationDashboard as fetchGamificationDashboardService } from '@/services/gamification/gamification';
import { Award, BookOpen, Flame, Star, TrendingUp, Trophy, Users } from 'lucide-react';
import type { DashboardData, OrganizationLeaderboard } from '@/types/gamification';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGamification } from '@/hooks/useGamification';
import { useProvideStreaks } from '@/hooks/useStreaks';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface LearnerDashboardProps {
  orgId: number;
  orgSlug: string;
  courses?: any[];
  className?: string;
  serverDashboardData?: DashboardData | null;
  serverLeaderboardData?: OrganizationLeaderboard | null;
}

export function LearnerDashboard({
  orgId,
  orgSlug,
  courses = [],
  className = '',
  serverDashboardData = null,
  serverLeaderboardData = null,
}: LearnerDashboardProps) {
  const { data: session } = useSession();
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');
  const [activeTab, setActiveTab] = useState('profile');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(serverDashboardData);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(!serverDashboardData);

  // Initialize unified gamification (auto profile fetch)
  // Seed profile cache with server data to avoid nulls in other widgets
  const accessToken: string | undefined = (session as any)?.tokens?.access_token;
  useGamification({
    orgId,
    accessToken,
    enabled: !serverDashboardData,
    initialData: serverDashboardData?.profile,
  });
  const { streaks } = useProvideStreaks(orgId, accessToken);

  // Fetch gamification dashboard (normalized) for Quick Stats
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (serverDashboardData) {
        // Already provided by server
        setIsLoadingDashboard(false);
        return;
      }
      if (!session?.tokens?.access_token) {
        setIsLoadingDashboard(false);
        return;
      }
      try {
        setIsLoadingDashboard(true);
        const data = await fetchGamificationDashboardService(orgId, session.tokens.access_token);
        if (!cancelled) setDashboardData(data);
      } catch (error) {
        if (!cancelled) console.error('Error fetching gamification dashboard:', error);
      } finally {
        if (!cancelled) setIsLoadingDashboard(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [orgId, session?.tokens?.access_token, serverDashboardData]);

  // Don't show for anonymous users
  if (!session?.user) {
    return null;
  }

  return (
    <div className={`w-full space-y-6 ${className}`}>
      {/* Dashboard Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger
            value="profile"
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            {t('dashboard.profile')}
          </TabsTrigger>
          <TabsTrigger
            value="overview"
            className="flex items-center gap-2"
          >
            <Trophy className="h-4 w-4" />
            {t('dashboard.progress')}
          </TabsTrigger>
          <TabsTrigger
            value="community"
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            {t('dashboard.community')}
          </TabsTrigger>
        </TabsList>

        {/* Progress Tab */}
        <TabsContent
          value="overview"
          className="space-y-6"
        >
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {t('dashboard.quickStats')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <BookOpen className="mx-auto mb-2 h-8 w-8 text-blue-500" />
                  <p className="text-2xl font-bold">{courses.length}</p>
                  <p className="text-muted-foreground text-sm">{t('dashboard.availableCourses')}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <Star className="mx-auto mb-2 h-8 w-8 text-yellow-500" />
                  <p className="text-2xl font-bold">
                    {isLoadingDashboard ? '...' : ((dashboardData as any)?.total_courses_completed ?? 0)}
                  </p>
                  <p className="text-muted-foreground text-sm">{t('dashboard.completed')}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <Award className="mx-auto mb-2 h-8 w-8 text-green-500" />
                  <p className="text-2xl font-bold">
                    {isLoadingDashboard ? '...' : (dashboardData as any)?.total_certificates || 0}
                  </p>
                  <p className="text-muted-foreground text-sm">{t('dashboard.certificates')}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <Flame className="mx-auto mb-2 h-8 w-8 text-orange-500" />
                  <p className="text-2xl font-bold">
                    {isLoadingDashboard ? '...' : (streaks?.login ?? dashboardData?.profile?.login_streak ?? 0)}
                  </p>
                  <p className="text-muted-foreground text-sm">{t('dashboard.dayStreak')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Progress Section (server-provided data if available) */}
          <ClientGamificationDashboard
            orgId={orgId}
            data={serverDashboardData}
          />
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent
          value="profile"
          className="space-y-6"
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <GamificationProfileSection
              orgId={orgId}
              variant="full"
              showUnlocks
              data={serverDashboardData?.profile}
            />
            <StreakWidget orgId={orgId} />
          </div>
        </TabsContent>

        {/* Community Tab */}
        <TabsContent
          value="community"
          className="space-y-6"
        >
          <ClientLeaderboard
            orgId={orgId}
            limit={20}
            data={serverLeaderboardData ?? null}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
