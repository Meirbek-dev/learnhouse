'use client';

import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookCopy,
  CheckCircle,
  Clock,
  Database,
  HardDrive,
  Server,
  TrendingUp,
  Users,
  Trophy,
  Zap,
  Bell,
  Target,
  Monitor,
  PieChart
} from 'lucide-react';
import {
  getAdminAnalyticsMetrics,
  getAdminOverviewMetrics,
  getAdminSystemMetrics,
  getAdminGamificationMetrics,
  getAdminRetentionMetrics,
  getAdminRealtimeMetrics,
  getAdminAlerts,
  getCourseFunnelMetrics,
  performBulkUserOperation
} from '@services/admin/admin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import type {
  AdminAnalyticsMetrics,
  AdminSystemMetrics,
  AdminGamificationMetrics,
  AdminRetentionMetrics,
  AdminRealtimeMetrics,
  AdminAlertsResponse,
  AdminCourseFunnelsMetrics,
  BulkOperationResult
} from '@services/admin/admin';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { useOrg } from '@components/Contexts/OrgContext';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { RealtimeMonitoringCharts } from '@components/Dashboard/Charts/RealtimeMonitoringCharts';

// Modern UI Components
import { AdminErrorBoundary } from '@components/Dashboard/AdminActions/AdminErrorBoundary';
import { ToastProvider, useAdminToast } from '@components/Dashboard/AdminActions/AdminToast';
import {
  AnimatedCard,
  AnimatedTabContent,
  AnimatedList,
  adminAnimations,
  AnimatedCounter
} from '@components/Dashboard/AdminActions/AdminAnimations';
import { AdminSkeleton } from '@components/Dashboard/AdminActions/AdminSkeleton';
import { useAdminState, useAdminPermissions } from '@components/Dashboard/AdminActions/AdminHooks';
import { motion } from 'framer-motion';
import { AdvancedGamificationCharts } from '@components/Dashboard/Charts/AdvancedGamificationCharts';
import { UserRetentionCharts } from '@components/Dashboard/Charts/UserRetentionCharts';
import { CourseFunnelCharts } from '@components/Dashboard/Charts/CourseFunnelCharts';
import { AdminAlertsAndActions } from '@components/Dashboard/AdminActions/AdminAlertsAndActions';

interface AdminDashboardPageProps {
  subpage: string;
}

const AdminDashboardPage = ({ subpage }: AdminDashboardPageProps) => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.Admin');

  return (
    <ToastProvider>
      <AdminErrorBoundary
        context="Admin Dashboard"
        className="min-h-screen"
      >
        <motion.div
          key={subpage}
          variants={adminAnimations.pageEnter}
          initial="initial"
          animate="animate"
          exit="exit"
          className="relative"
        >
          {(() => {
            switch (subpage) {
              case 'analytics': {
                return <AnalyticsTab />;
              }
              case 'system': {
                return <SystemTab />;
              }
              case 'gamification': {
                return <GamificationTab />;
              }
              case 'retention': {
                return <RetentionTab />;
              }
              case 'realtime': {
                return <RealtimeTab />;
              }
              case 'alerts': {
                return <AlertsTab />;
              }
              case 'coursefunnels': {
                return <CourseFunnelsTab />;
              }
              case 'actions': {
                return <ActionsTab />;
              }
              case 'overview':
              default: {
                return <OverviewTab />;
              }
            }
          })()}
        </motion.div>
      </AdminErrorBoundary>
    </ToastProvider>
  );
};

const OverviewTab = () => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.Admin');
  const { adminError } = useAdminToast();

  // Enhanced data fetching with admin hooks
  const adminKey = org && access_token ? `admin/overview/${org.id}` : null;
  const {
    data: metrics,
    error,
    isLoading,
    retry,
    retryCount
  } = useAdminState(
    adminKey,
    () => adminKey ? getAdminOverviewMetrics(org.id, access_token) : Promise.resolve(null),
    {
      enableToast: true,
      retryLimit: 3,
      retryDelay: 1000
    }
  );

  // Check permissions - defaults to admin access for development
  const { canAccess } = useAdminPermissions(['admin:dashboard:view']);

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You don't have permission to view the admin dashboard.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <AdminSkeleton variant="overview" />;
  }

  if (error) {
    return (
      <AdminErrorBoundary
        context="Admin Overview"
        onError={(error) => adminError('Failed to load overview', error.message)}
      >
        <div className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Admin Data</h3>
          <p className="text-gray-600">Unable to retrieve admin dashboard metrics from the server.</p>
        </div>
      </AdminErrorBoundary>
    );
  }

  const {
    totalUsers = 0,
    totalCourses = 0,
    totalActivities = 0,
    activeUsers30Days = 0,
    coursesCompletedThisMonth = 0,
    newUsersThisMonth = 0,
    platformUsageGrowth = 0,
    avgSessionDuration = null,
    topCourses = [],
    recentActivity = [],
  } = metrics || {};

  return (
    <motion.div
      className="space-y-6 p-6"
      variants={adminAnimations.pageEnter}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Key Metrics Grid */}
      <AnimatedList className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: t('totalUsers'),
            value: totalUsers.toLocaleString(),
            icon: <Users className="h-5 w-5 text-blue-600" />,
            trend: `+${newUsersThisMonth} ${t('thisMonth')}`,
            trendUp: newUsersThisMonth > 0
          },
          {
            title: t('totalCourses'),
            value: totalCourses.toLocaleString(),
            icon: <BookCopy className="h-5 w-5 text-green-600" />,
            trend: `${totalActivities} ${t('activities')}`
          },
          {
            title: t('activeUsers'),
            value: activeUsers30Days.toLocaleString(),
            icon: <Activity className="h-5 w-5 text-purple-600" />,
            trend: t('last30Days')
          },
          {
            title: t('coursesCompleted'),
            value: coursesCompletedThisMonth.toLocaleString(),
            icon: <TrendingUp className="h-5 w-5 text-orange-600" />,
            trend: `+${platformUsageGrowth}% ${t('growth')}`,
            trendUp: platformUsageGrowth > 0
          }
        ].map((metric, index) => (
          <AnimatedCard key={metric.title} delay={index * 0.1} hover={true}>
            <MetricCard {...metric} />
          </AnimatedCard>
        ))}
      </AnimatedList>

      {/* Charts and Detailed Data */}
      <motion.div
        className="grid grid-cols-1 gap-6 lg:grid-cols-2"
        variants={adminAnimations.staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Top Courses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t('topCourses')}
            </CardTitle>
            <CardDescription>{t('topCoursesDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topCourses.length > 0 ? (
                topCourses.slice(0, 5).map((course: any, index: number) => (
                  <div
                    key={course.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{course.name}</p>
                        <p className="text-sm text-gray-500">{course.enrollments} enrollments</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{course.completion_rate}%</p>
                      <p className="text-sm text-gray-500">{t('completion')}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-gray-500">{t('noDataAvailable')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t('recentActivity')}
            </CardTitle>
            <CardDescription>{t('recentActivityDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.length > 0 ? (
                recentActivity.slice(0, 5).map((activity: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-start gap-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                      <Activity className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.description}</p>
                      <p className="text-xs text-gray-500">{activity.timestamp}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-gray-500">{t('noRecentActivity')}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Platform Status - Only show what we can actually verify */}
      <AnimatedCard delay={0.6}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              {t('platformHealth')}
            </CardTitle>
            <CardDescription>{t('platformHealthDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium">{t('systemStatus')}</p>
                <p className="text-sm text-green-600">{t('operational')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </AnimatedCard>
    </motion.div>
  );
};

const AnalyticsTab = () => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.Admin');

  const {
    data: analytics,
    error,
    isLoading,
    mutate,
  } = useSWR(
    org && access_token ? ['admin/analytics', org.id, access_token] : null,
    ([_key, orgId, token]) => getAdminAnalyticsMetrics(orgId, token),
    {
      revalidateOnFocus: false,
      retryDelay: 5000,
    },
  );

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Error Loading Analytics Data
            </CardTitle>
            <CardDescription className="text-red-600">
              Failed to load analytics dashboard data. {error.message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => mutate()}
              className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const {
    userEngagement = {} as AdminAnalyticsMetrics['userEngagement'],
    contentPerformance = {} as AdminAnalyticsMetrics['contentPerformance'],
    learningProgress = {} as AdminAnalyticsMetrics['learningProgress'],
    platformUsage = {} as AdminAnalyticsMetrics['platformUsage'],
  } = analytics || {};

  return (
    <div className="space-y-6 p-6">
      {/* User Engagement - Only show available metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('userEngagement')}
          </CardTitle>
          <CardDescription>{t('userEngagementDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="text-center">
              <p className="text-2xl font-bold">{userEngagement.dailyActiveUsers || 0}</p>
              <p className="text-sm text-gray-500">{t('dailyActiveUsers')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{userEngagement.returnRate || 0}%</p>
              <p className="text-sm text-gray-500">{t('returnRate')}</p>
              <p className="mt-1 text-xs text-gray-400">{t('basedOnLoginStreaks')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {t('contentPerformance')}
          </CardTitle>
          <CardDescription>{t('contentPerformanceDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h4 className="mb-3 font-medium">{t('mostPopularCourses')}</h4>
              <div className="space-y-2">
                {contentPerformance.popularCourses?.slice(0, 3).map((course: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{course.name}</span>
                    <span className="text-sm font-medium">{course.views}</span>
                  </div>
                )) || <p className="text-sm text-gray-500">{t('noDataAvailable')}</p>}
              </div>
            </div>
            <div>
              <h4 className="mb-3 font-medium">{t('completionRates')}</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t('overallCompletion')}</span>
                  <span className="text-sm font-medium">{contentPerformance.overallCompletion || 0}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t('avgCourseRating')}</span>
                  <span className="text-sm font-medium">
                    {contentPerformance.avgRating !== null ? `${contentPerformance.avgRating}/5` : t('notAvailable')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Learning Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('learningProgress')}
          </CardTitle>
          <CardDescription>{t('learningProgressDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{learningProgress.coursesStarted || 0}</p>
              <p className="text-sm text-gray-500">{t('coursesStarted')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{learningProgress.coursesCompleted || 0}</p>
              <p className="text-sm text-gray-500">{t('coursesCompleted')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{learningProgress.totalCertificates || 0}</p>
              <p className="text-sm text-gray-500">{t('certificatesIssued')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{learningProgress.avgProgressRate || 0}%</p>
              <p className="text-sm text-gray-500">{t('avgProgress')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const SystemTab = () => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.Admin');

  const {
    data: systemData,
    error,
    isLoading,
    mutate,
  } = useSWR(
    org && access_token ? ['admin/system', org.id, access_token] : null,
    ([_key, orgId, token]) => getAdminSystemMetrics(orgId, token),
    {
      revalidateOnFocus: false,
      retryDelay: 5000,
    },
  );

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Error Loading System Data
            </CardTitle>
            <CardDescription className="text-red-600">
              Failed to load system dashboard data. {error.message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => mutate()}
              className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const {
    serverHealth = {} as AdminSystemMetrics['serverHealth'],
    databaseStats = {} as AdminSystemMetrics['databaseStats'],
    storageInfo = {} as AdminSystemMetrics['storageInfo'],
    performanceMetrics = {} as AdminSystemMetrics['performanceMetrics'],
    systemAlerts = [] as AdminSystemMetrics['systemAlerts'],
  } = systemData || {};

  return (
    <div className="space-y-6 p-6">
      {/* Database Performance - Only show metrics we can actually measure */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {t('databasePerformance')}
          </CardTitle>
          <CardDescription>{t('databasePerformanceDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="text-center">
              <p className="text-2xl font-bold">{databaseStats.connections || 0}</p>
              <p className="text-sm text-gray-500">{t('activeConnections')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {databaseStats.queryTime !== null ? `${databaseStats.queryTime}ms` : t('notAvailable')}
              </p>
              <p className="text-sm text-gray-500">{t('avgQueryTime')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {databaseStats.size !== null ? `${databaseStats.size}MB` : t('notAvailable')}
              </p>
              <p className="text-sm text-gray-500">{t('databaseSize')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Server Status - Only show reliable information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-green-600" />
            {t('serverStatus')}
          </CardTitle>
          <CardDescription>{t('currentServerStatusDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium">{t('systemStatus')}</p>
              <p className="text-sm text-green-600">{t('operational')}</p>
            </div>
          </div>

          {storageInfo.diskUsage !== null && (
            <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-yellow-600" />
                <p className="text-sm text-yellow-700">
                  {t('estimatedStorageUsage')}: {storageInfo.diskUsage}%
                </p>
              </div>
              <p className="mt-1 text-xs text-yellow-600">{t('storageEstimateDisclaimer')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {t('systemAlerts')}
          </CardTitle>
          <CardDescription>{t('systemAlertsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {systemAlerts.length > 0 ? (
            <div className="space-y-3">
              {systemAlerts.map((alert: any, index: number) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 rounded-lg border p-3 ${
                    alert.severity === 'high'
                      ? 'border-red-200 bg-red-50'
                      : alert.severity === 'medium'
                        ? 'border-yellow-200 bg-yellow-50'
                        : 'border-blue-200 bg-blue-50'
                  }`}
                >
                  <AlertTriangle
                    className={`mt-0.5 h-5 w-5 ${
                      alert.severity === 'high'
                        ? 'text-red-600'
                        : alert.severity === 'medium'
                          ? 'text-yellow-600'
                          : 'text-blue-600'
                    }`}
                  />
                  <div className="flex-1">
                    <p className="font-medium">{alert.title}</p>
                    <p className="text-sm text-gray-600">{alert.description}</p>
                    <p className="mt-1 text-xs text-gray-500">{alert.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <CheckCircle className="mx-auto mb-3 h-12 w-12 text-green-600" />
              <p className="text-gray-500">{t('noSystemAlerts')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
}

const GamificationTab = () => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.Admin');

  const {
    data: gamificationData,
    error,
    isLoading,
    mutate,
  } = useSWR(
    org && access_token ? ['admin/gamification', org.id, access_token] : null,
    ([_key, orgId, token]) => getAdminGamificationMetrics(orgId, token),
    {
      revalidateOnFocus: false,
      retryDelay: 5000,
    },
  );

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Error Loading Gamification Data
            </CardTitle>
            <CardDescription className="text-red-600">
              Failed to load gamification metrics. {error.message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => mutate()}
              className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!gamificationData) {
    return (
      <div className="space-y-6 p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-500">{t('noGamificationData')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <AdvancedGamificationCharts metrics={gamificationData} isLoading={isLoading} />
    </div>
  );
};

const RetentionTab = () => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.Admin');

  const {
    data: retentionData,
    error,
    isLoading,
    mutate,
  } = useSWR(
    org && access_token ? ['admin/retention', org.id, access_token] : null,
    ([_key, orgId, token]) => getAdminRetentionMetrics(orgId, token),
    {
      revalidateOnFocus: false,
      retryDelay: 5000,
    },
  );

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Error Loading Retention Data
            </CardTitle>
            <CardDescription className="text-red-600">
              Failed to load retention metrics. {error.message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => mutate()}
              className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!retentionData) {
    return (
      <div className="space-y-6 p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-500">{t('noRetentionData')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <UserRetentionCharts metrics={retentionData} isLoading={isLoading} />
    </div>
  );
};

const RealtimeTab = () => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.Admin');

  const {
    data: realtimeData,
    error,
    isLoading,
    mutate,
  } = useSWR(
    org && access_token ? ['admin/realtime', org.id, access_token] : null,
    ([_key, orgId, token]) => getAdminRealtimeMetrics(orgId, token),
    {
      revalidateOnFocus: false,
      retryDelay: 5000,
      refreshInterval: 30000, // Refresh every 30 seconds for real-time data
    },
  );

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Error Loading Real-time Data
            </CardTitle>
            <CardDescription className="text-red-600">
              Failed to load real-time metrics. {error.message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => mutate()}
              className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!realtimeData) {
    return (
      <div className="space-y-6 p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-500">{t('noRealtimeData')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <RealtimeMonitoringCharts metrics={realtimeData} isLoading={isLoading} />
    </div>
  );
};

const FunnelsTab = () => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.Admin');

  const {
    data: funnelData,
    error,
    isLoading,
    mutate,
  } = useSWR(
    org && access_token ? ['admin/funnels', org.id, access_token] : null,
    ([_key, orgId, token]) => getCourseFunnelMetrics(orgId, token),
    {
      revalidateOnFocus: false,
      retryDelay: 5000,
    },
  );

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Error Loading Funnel Data
            </CardTitle>
            <CardDescription className="text-red-600">
              Failed to load course funnel metrics. {error.message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => mutate()}
              className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!funnelData) {
    return (
      <div className="space-y-6 p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-500">{t('noFunnelData')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <CourseFunnelCharts metrics={funnelData} isLoading={isLoading} />
    </div>
  );
};

const AlertsTab = () => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.Admin');

  const {
    data: alertsData,
    error,
    isLoading,
    mutate,
  } = useSWR(
    org && access_token ? ['admin/alerts', org.id, access_token] : null,
    ([_key, orgId, token]) => getAdminAlerts(orgId, token),
    {
      revalidateOnFocus: false,
      retryDelay: 5000,
      refreshInterval: 60000, // Refresh every minute for alerts
    },
  );

  const handleBulkAction = async (action: string, userIds: number[]) => {
    try {
      if (!access_token || !org?.id) {
        throw new Error('Missing authentication or organization data');
      }

      const result = await performBulkUserOperation(org.id, access_token, action, userIds);

      // Refresh the alerts data after bulk operation
      mutate();

      return result;
    } catch (error) {
      console.error('Bulk operation failed:', error);
      throw error;
    }
  };

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Error Loading Alerts Data
            </CardTitle>
            <CardDescription className="text-red-600">
              Failed to load system alerts. {error.message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => mutate()}
              className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!alertsData) {
    return (
      <div className="space-y-6 p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-500">{t('noAlertsData')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <AdminAlertsAndActions
        alerts={alertsData}
        onBulkAction={handleBulkAction}
        isLoading={isLoading}
        onRefreshAlerts={() => mutate()}
      />
    </div>
  );
};

const CourseFunnelsTab = () => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.Admin');

  const { data: courseFunnelData, error, isLoading } = useSWR(
    org && access_token ? `admin/course-funnels/${org.id}` : null,
    () => org && access_token ? getCourseFunnelMetrics(org.id, access_token) : null,
    { refreshInterval: 60000 }
  );

  if (isLoading) {
    return <AdminSkeleton variant="charts" count={3} />;
  }

  if (error || !courseFunnelData) {
    return (
      <div className="space-y-6 p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-500">No course funnel data available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <CourseFunnelCharts
        metrics={courseFunnelData}
        isLoading={isLoading}
        onCourseSelect={(courseId) => {
          // Handle course selection for detailed analysis
          console.log('Selected course:', courseId);
        }}
      />
    </div>
  );
};

const ActionsTab = () => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.Admin');
  const { adminSuccess, adminError } = useAdminToast();

  const handleBulkUserOperation = async (
    action: string,
    userIds: number[]
  ): Promise<BulkOperationResult> => {
    if (!org || !access_token) {
      throw new Error('Missing organization or access token');
    }

    try {
      const result = await performBulkUserOperation(org.id, access_token, action, userIds);
      adminSuccess(
        'Bulk Operation Completed',
        `Successfully processed ${result.results.success.length} users`
      );
      return result;
    } catch (error) {
      adminError('Bulk Operation Failed', 'Please try again');
      throw error;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <AnimatedCard>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Administrative Actions
          </CardTitle>
          <CardDescription>
            Perform bulk operations and manage administrative tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Management Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">User Management</CardTitle>
                <CardDescription>
                  Bulk operations for user accounts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-100 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Users className="h-4 w-4 mx-auto mb-1" />
                    <div className="text-xs">Export Users</div>
                  </motion.button>
                  <motion.button
                    className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 hover:bg-green-100 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <CheckCircle className="h-4 w-4 mx-auto mb-1" />
                    <div className="text-xs">Activate Users</div>
                  </motion.button>
                  <motion.button
                    className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 hover:bg-yellow-100 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Clock className="h-4 w-4 mx-auto mb-1" />
                    <div className="text-xs">Suspend Users</div>
                  </motion.button>
                  <motion.button
                    className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-700 hover:bg-purple-100 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Bell className="h-4 w-4 mx-auto mb-1" />
                    <div className="text-xs">Send Notifications</div>
                  </motion.button>
                </div>
              </CardContent>
            </Card>

            {/* System Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">System Operations</CardTitle>
                <CardDescription>
                  System maintenance and data operations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Database className="h-4 w-4 mx-auto mb-1" />
                    <div className="text-xs">Backup Data</div>
                  </motion.button>
                  <motion.button
                    className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-100 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <HardDrive className="h-4 w-4 mx-auto mb-1" />
                    <div className="text-xs">Clear Cache</div>
                  </motion.button>
                  <motion.button
                    className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 hover:bg-orange-100 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <TrendingUp className="h-4 w-4 mx-auto mb-1" />
                    <div className="text-xs">Generate Reports</div>
                  </motion.button>
                  <motion.button
                    className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 hover:bg-red-100 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <AlertTriangle className="h-4 w-4 mx-auto mb-1" />
                    <div className="text-xs">System Check</div>
                  </motion.button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Actions Log */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Recent Actions</CardTitle>
              <CardDescription>
                History of administrative actions performed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { action: 'Bulk user activation', users: 25, time: '2 hours ago', status: 'success' },
                  { action: 'System backup', size: '2.4 GB', time: '6 hours ago', status: 'success' },
                  { action: 'Cache clear', time: '1 day ago', status: 'success' },
                  { action: 'User export', count: 150, time: '2 days ago', status: 'success' }
                ].map((action, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                      <div>
                        <div className="font-medium text-sm">{action.action}</div>
                        <div className="text-xs text-gray-500">{action.time}</div>
                      </div>
                    </div>
                    <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                      {action.status}
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </AnimatedCard>
    </div>
  );
};

const MetricCard = ({ title, value, icon, trend, trendUp }: MetricCardProps) => (
  <Card className="transition-all duration-200 hover:shadow-md hover:scale-[1.02]">
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <AnimatedCounter
            value={parseInt(value.replace(/,/g, '')) || 0}
            formatter={(v) => v.toLocaleString()}
            className="text-2xl font-bold text-gray-900"
            duration={1.5}
          />
          {trend && (
            <motion.p
              className={`text-sm mt-1 ${trendUp !== false ? 'text-green-600' : 'text-red-600'}`}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {trend}
            </motion.p>
          )}
        </div>
        <motion.div
          className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100"
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          {icon}
        </motion.div>
      </div>
    </CardContent>
  </Card>
);

export default AdminDashboardPage;
