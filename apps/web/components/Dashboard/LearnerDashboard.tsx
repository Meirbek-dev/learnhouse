'use client';

import {
  GamificationDashboard as ClientGamificationDashboard,
  Leaderboard as ClientLeaderboard,
  GamificationProfileSection,
} from '@/components/Dashboard/Gamification';
import { GamificationProvider, useOptionalGamificationContext } from '@/components/Contexts/GamificationContext';
import { Award, BookOpen, Flame, Star, TrendingUp, Trophy, Users } from 'lucide-react';
import type { DashboardData, OrganizationLeaderboard } from '@/types/gamification';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface LearnerDashboardProps {
  orgId: number;
  orgSlug: string;
  courses?: any[];
  className?: string;
  serverDashboardData?: DashboardData | null;
  serverLeaderboardData?: OrganizationLeaderboard | null;
}

// Inner component that uses the context
function LearnerDashboardContent({ orgId, orgSlug: _orgSlug, courses = [], className = '' }: LearnerDashboardProps) {
  const { data: session } = useSession();
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');
  const [activeTab, setActiveTab] = useState('profile');

  // Use unified context - eliminates redundant state management
  const gamificationContext = useOptionalGamificationContext();

  if (!gamificationContext) {
    throw new Error('LearnerDashboardContent must be used within GamificationProvider');
  }

  const { profile, dashboard, leaderboard, isLoading, streaks } = gamificationContext;

  // Don't show for anonymous users
  if (!session?.user) {
    return null;
  }

  return (
    <div className={`space-y-6 ${className}`}>
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
                  <p className="text-2xl font-bold">{isLoading ? '...' : (profile?.total_courses_completed ?? 0)}</p>
                  <p className="text-muted-foreground text-sm">{t('dashboard.completed')}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <Award className="mx-auto mb-2 h-8 w-8 text-green-500" />
                  <p className="text-2xl font-bold">{isLoading ? '...' : '0'}</p>
                  <p className="text-muted-foreground text-sm">{t('dashboard.certificates')}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <Flame className="mx-auto mb-2 h-8 w-8 text-orange-500" />
                  <p className="text-2xl font-bold">{isLoading ? '...' : (streaks?.login ?? 0)}</p>
                  <p className="text-muted-foreground text-sm">{t('dashboard.dayStreak')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Progress Section */}
          <ClientGamificationDashboard
            orgId={orgId}
            data={dashboard}
          />
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent
          value="profile"
          className="space-y-6"
        >
          <GamificationProfileSection
            orgId={orgId}
            variant="full"
            showUnlocks
            data={profile}
          />
        </TabsContent>

        {/* Community Tab */}
        <TabsContent
          value="community"
          className="space-y-6"
        >
          <ClientLeaderboard
            orgId={orgId}
            limit={20}
            data={leaderboard}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Main component with provider wrapper
export function LearnerDashboard(props: LearnerDashboardProps) {
  return (
    <GamificationProvider
      orgId={props.orgId}
      initialData={{
        profile: props.serverDashboardData?.profile,
        dashboard: props.serverDashboardData,
        leaderboard: props.serverLeaderboardData,
      }}
    >
      <LearnerDashboardContent {...props} />
    </GamificationProvider>
  );
}
