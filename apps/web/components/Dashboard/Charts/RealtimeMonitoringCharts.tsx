'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Badge } from '@components/ui/badge';
import { Progress } from '@components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { ScrollArea } from '@components/ui/scroll-area';
import { Alert, AlertDescription } from '@components/ui/alert';
import {
  Activity,
  Users,
  Clock,
  TrendingUp,
  Monitor,
  BookOpen,
  AlertCircle,
  Wifi,
  RefreshCw
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AdminRealtimeMetrics } from '@services/admin/admin';

interface RealtimeMonitoringChartsProps {
  metrics: AdminRealtimeMetrics;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const RealtimeMonitoringCharts = ({
  metrics,
  isLoading = false,
  onRefresh
}: RealtimeMonitoringChartsProps) => {
  const t = useTranslations('DashPage.Admin.Realtime');

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'assignment_submission':
        return <BookOpen className="h-4 w-4 text-blue-600" />;
      case 'login':
        return <Users className="h-4 w-4 text-green-600" />;
      case 'course_access':
        return <Monitor className="h-4 w-4 text-purple-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'assignment_submission':
        return 'bg-blue-50 border-blue-200';
      case 'login':
        return 'bg-green-50 border-green-200';
      case 'course_access':
        return 'bg-purple-50 border-purple-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Live Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
            <h2 className="text-xl font-semibold">{t('title')}</h2>
          </div>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <Wifi className="h-3 w-3 mr-1" />
            {t('live')}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {t('lastUpdated')}: {formatTimestamp(metrics.lastUpdated)}
          </span>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('liveUsers')}</p>
                <p className="text-3xl font-bold text-green-600">{metrics.liveUsers.count}</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-gray-500">{metrics.liveUsers.trend}</span>
                </div>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <Users className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('activeSessions')}</p>
                <p className="text-3xl font-bold text-blue-600">
                  {metrics.activeSessions.reduce((sum, session) => sum + session.activeSessions, 0)}
                </p>
                <p className="text-sm text-gray-500">{t('totalSessions')}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Monitor className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('recentActivity')}</p>
                <p className="text-3xl font-bold text-purple-600">{metrics.activityFeed.length}</p>
                <p className="text-sm text-gray-500">{t('lastHour')}</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Activity className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Views */}
      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sessions">{t('activeSessions')}</TabsTrigger>
          <TabsTrigger value="activity">{t('activityFeed')}</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                {t('activeCourseSessions')}
              </CardTitle>
              <CardDescription>
                {t('courseSessionsDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.activeSessions.length > 0 ? (
                <div className="space-y-4">
                  {metrics.activeSessions.map((session, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <BookOpen className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{session.courseName}</p>
                          <p className="text-sm text-gray-500">{t('course')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">
                          {session.activeSessions}
                        </p>
                        <p className="text-sm text-gray-500">{t('activeSessions')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('noActiveSessions')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                {t('liveActivityFeed')}
              </CardTitle>
              <CardDescription>
                {t('activityFeedDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {metrics.activityFeed.length > 0 ? (
                  <div className="space-y-3">
                    {metrics.activityFeed.map((activity, index) => (
                      <div
                        key={index}
                        className={`flex items-start gap-3 p-3 border rounded-lg ${getActivityColor(activity.type)}`}
                      >
                        <div className="mt-1">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {activity.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {formatTimestamp(activity.timestamp)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              User #{activity.userId}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{t('noRecentActivity')}</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* System Status Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t('monitoringNote')}
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default RealtimeMonitoringCharts;
