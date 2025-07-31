'use client';

import { GamificationDashboard, Leaderboard, StreakWidget } from '@/components/Dashboard/Gamification';
import { Award, BookOpen, Flame, Star, Target, TrendingUp, Trophy, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RequestBodyWithAuthHeader } from '@/services/utils/ts/requests';
import { useGamification } from '@/hooks/useGamification';
import { getAPIUrl } from '@/services/config/config';
import { Button } from '@/components/ui/button';
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

interface LearnerDashboardProps {
  orgId: number;
  orgSlug: string;
  courses?: any[];
  className?: string;
}

export function LearnerDashboard({ orgId, orgSlug, courses = [], className = '' }: LearnerDashboardProps) {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);

  // Initialize gamification tracking
  useGamification({ orgId, enabled: !!session?.user });

  // Fetch gamification dashboard for Quick Stats
  useEffect(() => {
    const fetchGamificationDashboard = async () => {
      if (!session?.tokens?.access_token) {
        setIsLoadingDashboard(false);
        return;
      }

      try {
        setIsLoadingDashboard(true);
        const response = await fetch(`${getAPIUrl()}gamification/dashboard/${orgId}`, {
          ...RequestBodyWithAuthHeader('GET', null, null, session.tokens.access_token),
        });

        if (response.ok) {
          const data = await response.json();
          setDashboardData(data);
        }
      } catch (error) {
        console.error('Error fetching gamification dashboard:', error);
      } finally {
        setIsLoadingDashboard(false);
      }
    };

    fetchGamificationDashboard();
  }, [orgId, session?.tokens?.access_token]);

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
            value="overview"
            className="flex items-center gap-2"
          >
            <Target className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="progress"
            className="flex items-center gap-2"
          >
            <Trophy className="h-4 w-4" />
            Progress
          </TabsTrigger>
          <TabsTrigger
            value="community"
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            Community
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent
          value="overview"
          className="space-y-6"
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Quick Stats */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                    <BookOpen className="mx-auto mb-2 h-8 w-8 text-blue-500" />
                    <p className="text-2xl font-bold">{courses.length}</p>
                    <p className="text-muted-foreground text-sm">Available Courses</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                    <Star className="mx-auto mb-2 h-8 w-8 text-yellow-500" />
                    <p className="text-2xl font-bold">
                      {isLoadingDashboard ? '...' : dashboardData?.total_courses_completed || 0}
                    </p>
                    <p className="text-muted-foreground text-sm">Completed</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                    <Award className="mx-auto mb-2 h-8 w-8 text-green-500" />
                    <p className="text-2xl font-bold">
                      {isLoadingDashboard ? '...' : dashboardData?.total_certificates || 0}
                    </p>
                    <p className="text-muted-foreground text-sm">Certificates</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                    <Flame className="mx-auto mb-2 h-8 w-8 text-orange-500" />
                    <p className="text-2xl font-bold">
                      {isLoadingDashboard ? '...' : dashboardData?.profile?.current_login_streak || 0}
                    </p>
                    <p className="text-muted-foreground text-sm">Day Streak</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Streaks Widget */}
            <StreakWidget orgId={orgId} />
          </div>
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent
          value="progress"
          className="space-y-6"
        >
          <GamificationDashboard orgId={orgId} />
        </TabsContent>

        {/* Community Tab */}
        <TabsContent
          value="community"
          className="space-y-6"
        >
          <Leaderboard
            orgId={orgId}
            limit={10}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
