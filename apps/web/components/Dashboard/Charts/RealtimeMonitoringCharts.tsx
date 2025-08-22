'use client';

import { Activity, AlertCircle, BookOpen, Clock, Monitor, RefreshCw, TrendingUp, Users, Wifi } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import type { AdminRealtimeMetrics } from '@services/admin/admin';
import { Alert, AlertDescription } from '@components/ui/alert';
import { useFormatter, useTranslations } from 'next-intl';
import { ScrollArea } from '@components/ui/scroll-area';
import { Badge } from '@components/ui/badge';
import { useTransition } from 'react';

interface RealtimeMonitoringChartsProps {
  metrics: AdminRealtimeMetrics;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const RealtimeMonitoringCharts = ({ metrics, isLoading = false, onRefresh }: RealtimeMonitoringChartsProps) => {
  const t = useTranslations('DashPage.Admin.Realtime');
  const format = useFormatter();
  const [isPending, startTransition] = useTransition();

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return format.dateTime(date, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (error) {
      console.warn('Invalid timestamp format in formatTimestamp:', timestamp, error);
      return timestamp;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'assignment_submission': {
        return <BookOpen className="h-4 w-4 text-blue-600" />;
      }
      case 'login': {
        return <Users className="h-4 w-4 text-green-600" />;
      }
      case 'course_access': {
        return <Monitor className="h-4 w-4 text-purple-600" />;
      }
      default: {
        return <Activity className="h-4 w-4 text-gray-600" />;
      }
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'assignment_submission': {
        return 'bg-blue-50 border-blue-200';
      }
      case 'login': {
        return 'bg-green-50 border-green-200';
      }
      case 'course_access': {
        return 'bg-purple-50 border-purple-200';
      }
      default: {
        return 'bg-gray-50 border-gray-200';
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Live Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 animate-pulse rounded-full bg-green-500" />
            <h2 className="text-xl font-semibold">{t('title')}</h2>
          </div>
          <Badge
            variant="outline"
            className="border-green-200 bg-green-50 text-green-700"
          >
            <Wifi className="mr-1 h-3 w-3" />
            {t('live')}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {t('lastUpdated')}: {formatTimestamp(metrics.lastUpdated)}
          </span>
          <button
            onClick={() => startTransition(() => onRefresh?.())}
            disabled={isLoading || isPending}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading || isPending ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('metrics.activeUsers')}</p>
                <p className="text-3xl font-bold text-green-600">{metrics.liveUsers.count}</p>
                <div className="mt-1 flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-gray-500">{metrics.liveUsers.trend}</span>
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <Users className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('metrics.activeSessions')}</p>
                <p className="text-3xl font-bold text-blue-600">
                  {metrics.activeSessions.reduce((sum, session) => sum + session.activeSessions, 0)}
                </p>
                <p className="text-sm text-gray-500">{t('metrics.totalSessions')}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <Monitor className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('metrics.recentActivity')}</p>
                <p className="text-3xl font-bold text-purple-600">{metrics.activityFeed.length}</p>
                <p className="text-sm text-gray-500">{t('metrics.lastHour')}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                <Activity className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Views */}
      <Tabs
        defaultValue="sessions"
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sessions">{t('activeSessions')}</TabsTrigger>
          <TabsTrigger value="activity">{t('activityFeed')}</TabsTrigger>
        </TabsList>

        <TabsContent
          value="sessions"
          className="space-y-4"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                {t('sessions.title')}
              </CardTitle>
              <CardDescription>{t('sessions.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.activeSessions.length > 0 ? (
                <div className="space-y-4">
                  {metrics.activeSessions.map((session, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                          <BookOpen className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{session.courseName}</p>
                          <p className="text-sm text-gray-500">{t('sessions.course')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">{session.activeSessions}</p>
                        <p className="text-sm text-gray-500">{t('activeSessions')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  <Monitor className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>{t('sessions.empty')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="activity"
          className="space-y-4"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                {t('activity.title')}
              </CardTitle>
              <CardDescription>{t('activity.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {metrics.activityFeed.length > 0 ? (
                  <div className="space-y-3">
                    {metrics.activityFeed.map((activity, index) => (
                      <div
                        key={index}
                        className={`flex items-start gap-3 rounded-lg border p-3 ${getActivityColor(activity.type)}`}
                      >
                        <div className="mt-1">{getActivityIcon(activity.type)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <Clock className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-500">{formatTimestamp(activity.timestamp)}</span>
                            <Badge
                              variant="outline"
                              className="text-xs"
                            >
                              {t('activity.userBadge', { id: activity.userId })}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500">
                    <Activity className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p>{t('activity.empty')}</p>
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
        <AlertDescription>{t('monitoringNote')}</AlertDescription>
      </Alert>
    </div>
  );
};

export default RealtimeMonitoringCharts;
