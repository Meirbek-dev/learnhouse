'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Badge } from '@components/ui/badge';
import { Progress } from '@components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import {
  Trophy,
  Target,
  Zap,
  Users,
  Star,
  Award,
  TrendingUp,
  Calendar,
  BarChart3,
  PieChart
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AdminGamificationMetrics } from '@services/admin/admin';

interface AdvancedGamificationChartsProps {
  metrics: AdminGamificationMetrics;
  isLoading?: boolean;
}

export const AdvancedGamificationCharts = ({
  metrics,
  isLoading = false
}: AdvancedGamificationChartsProps) => {
  const t = useTranslations('DashPage.Admin.Gamification');

  const getLevelColor = (level: number) => {
    if (level >= 10) return 'bg-purple-500';
    if (level >= 7) return 'bg-blue-500';
    if (level >= 4) return 'bg-green-500';
    if (level >= 2) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const getEngagementLevel = (rate: number) => {
    if (rate >= 80) return { level: 'excellent', color: 'text-green-600', bg: 'bg-green-50' };
    if (rate >= 60) return { level: 'good', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (rate >= 40) return { level: 'moderate', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { level: 'low', color: 'text-red-600', bg: 'bg-red-50' };
  };

  // XP Distribution is now provided by the API
  const xpDistribution = metrics.xpDistribution || [];
  const engagementLevel = getEngagementLevel(metrics.engagementRate);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('totalProfiles')}</p>
                <p className="text-3xl font-bold">{metrics.totalProfiles}</p>
                <p className="text-sm text-gray-500">{t('gamificationUsers')}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('activeUsers')}</p>
                <p className="text-3xl font-bold text-green-600">{metrics.activeGamifiedUsers}</p>
                <p className="text-sm text-gray-500">{t('withXP')}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <Zap className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('engagementRate')}</p>
                <p className={`text-3xl font-bold ${engagementLevel.color}`}>
                  {metrics.engagementRate}%
                </p>
                <Badge variant="outline" className={`text-xs ${engagementLevel.bg} ${engagementLevel.color}`}>
                  {t(engagementLevel.level)}
                </Badge>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Target className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('averageXP')}</p>
                <p className="text-3xl font-bold text-orange-600">
                  {metrics.xpStatistics.averageXP.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">XP</p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                <Trophy className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="levels" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="levels">{t('levelDistribution')}</TabsTrigger>
          <TabsTrigger value="xp">{t('xpAnalysis')}</TabsTrigger>
          <TabsTrigger value="streaks">{t('streakAnalysis')}</TabsTrigger>
          <TabsTrigger value="insights">{t('insights')}</TabsTrigger>
        </TabsList>

        <TabsContent value="levels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                {t('userLevelDistribution')}
              </CardTitle>
              <CardDescription>
                {t('levelDistributionDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.levelDistribution.map((level) => {
                  const percentage = (level.users / metrics.totalProfiles * 100);
                  return (
                    <div key={level.level} className="flex items-center gap-4">
                      <div className="flex items-center gap-3 w-32">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${getLevelColor(level.level)}`}>
                          {level.level}
                        </div>
                        <span className="font-medium">{t('level')} {level.level}</span>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-600">
                            {level.users} {t('users')}
                          </span>
                          <span className="text-sm font-medium">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Level Insights */}
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-medium mb-3">{t('levelInsights')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium text-blue-900">{t('mostPopularLevel')}</p>
                    <p className="text-xs text-blue-700 mt-1">
                      {(() => {
                        const mostPopular = metrics.levelDistribution.reduce((max, current) =>
                          current.users > max.users ? current : max
                        );
                        return `${t('level')} ${mostPopular.level} (${mostPopular.users} ${t('users')})`;
                      })()}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm font-medium text-green-900">{t('highLevelUsers')}</p>
                    <p className="text-xs text-green-700 mt-1">
                      {(() => {
                        const highLevel = metrics.levelDistribution
                          .filter(l => l.level >= 7)
                          .reduce((sum, l) => sum + l.users, 0);
                        const percentage = (highLevel / metrics.totalProfiles * 100).toFixed(1);
                        return `${highLevel} ${t('users')} (${percentage}%)`;
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="xp" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  {t('xpStatistics')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{t('averageXP')}</p>
                      <p className="text-sm text-gray-600">{t('perUser')}</p>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">
                      {metrics.xpStatistics.averageXP.toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{t('maxXP')}</p>
                      <p className="text-sm text-gray-600">{t('topUser')}</p>
                    </div>
                    <p className="text-2xl font-bold text-orange-600">
                      {metrics.xpStatistics.maxXP.toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{t('totalXP')}</p>
                      <p className="text-sm text-gray-600">{t('allUsers')}</p>
                    </div>
                    <p className="text-2xl font-bold text-green-600">
                      {(metrics.xpStatistics.averageXP * metrics.totalProfiles).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  {t('xpDistribution')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {xpDistribution.length > 0 ? (
                    xpDistribution.map((range, index) => (
                      <div key={index} className="flex items-center gap-4">
                        <div className="w-32">
                          <span className="font-medium">{range.label}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-600">
                              {range.users} {t('users')}
                            </span>
                            <span className="text-sm font-medium">
                              {range.percentage}%
                            </span>
                          </div>
                          <Progress value={range.percentage} className="h-2" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <p className="text-sm">No XP distribution data available</p>
                      <p className="text-xs text-gray-400 mt-1">
                        No gamification activity recorded yet
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="streaks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {t('loginStreakAnalysis')}
              </CardTitle>
              <CardDescription>
                {t('streakDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                    <Calendar className="h-12 w-12 mx-auto mb-3 text-blue-600" />
                    <p className="text-sm font-medium text-blue-900">{t('averageStreak')}</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {metrics.streakStatistics.averageLoginStreak}
                    </p>
                    <p className="text-sm text-blue-700">{t('days')}</p>
                  </div>

                  <div className="text-center p-6 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg">
                    <Trophy className="h-12 w-12 mx-auto mb-3 text-orange-600" />
                    <p className="text-sm font-medium text-orange-900">{t('longestStreak')}</p>
                    <p className="text-3xl font-bold text-orange-600">
                      {metrics.streakStatistics.maxLoginStreak}
                    </p>
                    <p className="text-sm text-orange-700">{t('days')}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-4">{t('streakCategories')}</h4>
                  <div className="text-center text-gray-500 py-6">
                    <p className="text-sm">Streak distribution data is not available</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Backend implementation required for user streak categorization
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {t('gamificationInsights')}
              </CardTitle>
              <CardDescription>
                {t('insightsDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-4">{t('keyMetrics')}</h4>
                  <div className="space-y-4">
                    <div className={`p-4 rounded-lg ${engagementLevel.bg}`}>
                      <p className={`font-medium ${engagementLevel.color}`}>
                        {t('engagementLevel')}: {t(engagementLevel.level)}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {metrics.engagementRate}% {t('ofUsersActive')}
                      </p>
                    </div>

                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="font-medium text-blue-900">{t('progressionRate')}</p>
                      <p className="text-sm text-blue-700 mt-1">
                        {(() => {
                          const advancedUsers = metrics.levelDistribution
                            .filter(l => l.level >= 5)
                            .reduce((sum, l) => sum + l.users, 0);
                          const rate = (advancedUsers / metrics.totalProfiles * 100).toFixed(1);
                          return `${rate}% ${t('reachedLevel5Plus')}`;
                        })()}
                      </p>
                    </div>

                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="font-medium text-purple-900">{t('retentionIndicator')}</p>
                      <p className="text-sm text-purple-700 mt-1">
                        {metrics.streakStatistics.averageLoginStreak > 5
                          ? t('goodRetention')
                          : t('needsImprovement')
                        }
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-4">{t('recommendations')}</h4>
                  <div className="space-y-3">
                    {metrics.engagementRate < 50 && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm font-medium text-yellow-800">
                          {t('lowEngagementRecommendation')}
                        </p>
                      </div>
                    )}

                    {metrics.streakStatistics.averageLoginStreak < 3 && (
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <p className="text-sm font-medium text-orange-800">
                          {t('streakImprovementRecommendation')}
                        </p>
                      </div>
                    )}

                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm font-medium text-green-800">
                        {t('generalRecommendation')}
                      </p>
                    </div>

                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium text-blue-800">
                        {t('levelProgressionTip')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedGamificationCharts;
