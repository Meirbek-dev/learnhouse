'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Progress } from '@components/ui/progress';
import {
  Users,
  BookOpen,
  Activity,
  TrendingUp,
  Calendar,
  Clock,
  ChevronRight,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AdminOverviewMetrics } from '@services/admin/admin';

interface AdminOverviewProps {
  metrics: AdminOverviewMetrics;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const AdminOverview = ({
  metrics,
  isLoading = false,
  onRefresh
}: AdminOverviewProps) => {
  const t = useTranslations('DashPage.Admin.Overview');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

  const formatGrowth = (growth: number) => {
    const formatted = Math.abs(growth).toFixed(1);
    const sign = growth >= 0 ? '+' : '-';
    return `${sign}${formatted}%`;
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return 'text-green-600';
    if (growth < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('totalUsers')}</p>
                <p className="text-3xl font-bold">{metrics.totalUsers.toLocaleString()}</p>
                {metrics.newUsersThisMonth > 0 && (
                  <p className="text-sm text-green-600 mt-1">
                    +{metrics.newUsersThisMonth} {t('thisMonth')}
                  </p>
                )}
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
                <p className="text-sm font-medium text-gray-600">{t('totalCourses')}</p>
                <p className="text-3xl font-bold">{metrics.totalCourses.toLocaleString()}</p>
                <p className="text-sm text-gray-500">{t('activeCourses')}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('totalActivities')}</p>
                <p className="text-3xl font-bold">{metrics.totalActivities.toLocaleString()}</p>
                <p className="text-sm text-gray-500">{t('allCourses')}</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Activity className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('activeUsers30Days')}</p>
                <p className="text-3xl font-bold">{metrics.activeUsers30Days.toLocaleString()}</p>
                <p className="text-sm text-gray-500">{t('lastMonth')}</p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Growth and Completion Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t('thisMonth')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{t('newUsers')}</p>
                  <p className="text-sm text-gray-600">{t('userRegistrations')}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{metrics.newUsersThisMonth}</p>
                  {metrics.platformUsageGrowth !== 0 && (
                    <p className={`text-sm ${getGrowthColor(metrics.platformUsageGrowth)}`}>
                      {formatGrowth(metrics.platformUsageGrowth)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{t('coursesCompleted')}</p>
                  <p className="text-sm text-gray-600">{t('completionThisMonth')}</p>
                </div>
                <p className="text-2xl font-bold">{metrics.coursesCompletedThisMonth}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t('sessionMetrics')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{t('avgSessionDuration')}</p>
                  <p className="text-sm text-gray-600">{t('perUser')}</p>
                </div>
                <div className="text-right">
                  {metrics.avgSessionDuration !== null ? (
                    <p className="text-2xl font-bold">
                      {Math.round(metrics.avgSessionDuration / 60)}m
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-500">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">{t('notAvailable')}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700 mb-2">{t('engagementNote')}</p>
                <p className="text-xs text-blue-600">
                  {t('sessionTrackingRequired')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Courses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {t('topCourses')}
          </CardTitle>
          <CardDescription>
            {t('mostPopularCourses')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.topCourses.length > 0 ? (
            <div className="space-y-4">
              {metrics.topCourses.map((course, index) => (
                <div key={course.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-8 h-8 rounded-full p-0 flex items-center justify-center">
                      {index + 1}
                    </Badge>
                    <div>
                      <p className="font-medium">{course.name}</p>
                      <p className="text-sm text-gray-600">
                        {course.enrollments} {t('enrollments')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-600">{t('completion')}</p>
                      <div className="flex items-center gap-2">
                        <Progress value={course.completion_rate} className="w-16" />
                        <span className="text-sm font-medium">{course.completion_rate}%</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <BookOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">{t('noCourses')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {t('recentActivity')}
          </CardTitle>
          <CardDescription>
            {t('last30Days')}
          </CardDescription>
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              {t('refresh')}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {metrics.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {metrics.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.description}</p>
                    <p className="text-xs text-gray-500">{activity.timestamp}</p>
                  </div>
                  <Badge variant="outline">{activity.type}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">{t('noRecentActivity')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOverview;
