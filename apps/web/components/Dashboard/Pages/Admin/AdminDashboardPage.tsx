'use client';

import {
  getAdminAlerts,
  getAdminAnalyticsMetrics,
  getAdminGamificationMetrics,
  getAdminOverviewMetrics,
  getAdminRealtimeMetrics,
  getAdminRetentionMetrics,
  getCourseFunnelMetrics,
  performBulkUserOperation,
} from '@services/admin/admin';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BookCopy,
  CheckCircle,
  Clock,
  Database,
  HardDrive,
  TrendingUp,
  Users,
} from 'lucide-react';
// Modern UI Components
import {
  AnimatedCard,
  AnimatedCounter,
  AnimatedList,
  adminAnimations,
} from '@components/Dashboard/AdminActions/AdminAnimations';
import { AdvancedGamificationCharts } from '@components/Dashboard/Charts/AdvancedGamificationCharts';
import { useAdminPermissions, useAdminState } from '@components/Dashboard/AdminActions/AdminHooks';
import { AdminAlertsAndActions } from '@components/Dashboard/AdminActions/AdminAlertsAndActions';
import { RealtimeMonitoringCharts } from '@components/Dashboard/Charts/RealtimeMonitoringCharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { ToastProvider, useAdminToast } from '@components/Dashboard/AdminActions/AdminToast';
import type { AdminAnalyticsMetrics, BulkOperationResult } from '@services/admin/admin';
import { UserRetentionCharts } from '@components/Dashboard/Charts/UserRetentionCharts';
import { CourseFunnelCharts } from '@components/Dashboard/Charts/CourseFunnelCharts';
import { AdminSkeleton } from '@components/Dashboard/AdminActions/AdminSkeleton';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { useOrg } from '@components/Contexts/OrgContext';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import useSWR from 'swr';

interface AdminDashboardPageProps {
  subpage: string;
}

const AdminDashboardPage = ({ subpage }: AdminDashboardPageProps) => {
  const t = useTranslations('DashPage.Admin');

  return (
    <ToastProvider>
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
              return <AnalyticsTab t={t} />;
            }
            case 'gamification': {
              return <GamificationTab t={t} />;
            }
            case 'retention': {
              return <RetentionTab t={t} />;
            }
            case 'realtime': {
              return <RealtimeTab t={t} />;
            }
            case 'alerts': {
              return <AlertsTab t={t} />;
            }
            case 'coursefunnels': {
              return <CourseFunnelsTab t={t} />;
            }
            case 'actions': {
              return <ActionsTab t={t} />;
            }
            default: {
              return <OverviewTab t={t} />;
            }
          }
        })()}
      </motion.div>
    </ToastProvider>
  );
};

const OverviewTab = ({ t }: { t: any }) => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;

  const adminKey = org && access_token ? `admin/overview/${org.id}` : null;
  const {
    data: metrics,
    error,
    isLoading,
  } = useAdminState(
    adminKey,
    () => (adminKey ? getAdminOverviewMetrics(org.id, access_token) : Promise.resolve(null)),
    {
      enableToast: true,
      retryLimit: 3,
      retryDelay: 1000,
    },
  );

  // Check permissions - defaults to admin access for development
  const { canAccess } = useAdminPermissions(['admin:dashboard:view']);

  if (!canAccess) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="min-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              {t('accessDenied')}
            </CardTitle>
            <CardDescription>{t('accessDeniedDescription')}</CardDescription>
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
      <div className="p-6 text-center">
        <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-500" />
        <h3 className="mb-2 text-lg font-semibold text-gray-900">{t('failedToLoadAdminData')}</h3>
        <p className="text-gray-600">{t('failedToLoadAdminDataDescription')}</p>
      </div>
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
            trendUp: newUsersThisMonth > 0,
          },
          {
            title: t('totalCourses'),
            value: totalCourses.toLocaleString(),
            icon: <BookCopy className="h-5 w-5 text-green-600" />,
            trend: `${totalActivities} ${t('activities')}`,
          },
          {
            title: t('activeUsers'),
            value: activeUsers30Days.toLocaleString(),
            icon: <Activity className="h-5 w-5 text-purple-600" />,
            trend: t('last30Days'),
          },
          {
            title: t('coursesCompleted'),
            value: coursesCompletedThisMonth.toLocaleString(),
            icon: <TrendingUp className="h-5 w-5 text-orange-600" />,
            trend: `+${platformUsageGrowth}% ${t('growth')}`,
            trendUp: platformUsageGrowth > 0,
          },
        ].map((metric, index) => (
          <AnimatedCard
            key={metric.title}
            delay={index * 0.1}
            hover
          >
            <MetricCard {...metric} />
          </AnimatedCard>
        ))}
      </AnimatedList>

      {/* Charts and Detailed Data */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                topCourses.slice(0, 10).map((course: any, index: number) => (
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
                        <p className="text-sm text-gray-500">{t('enrollments', { count: course.enrollments })}</p>
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
                recentActivity.slice(0, 10).map((activity: any, index: number) => (
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
      </div>
    </motion.div>
  );
};

const AnalyticsTab = ({ t }: { t: any }) => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;

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
    return <AdminSkeleton variant="analytics" />;
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              {t('errorLoadingAnalyticsData')}
            </CardTitle>
            <CardDescription className="text-red-600">
              {t('failedToLoadAnalyticsData')} {error.message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => mutate()}
              className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              {t('retry')}
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
  } = analytics || {};

  return (
    <div className="space-y-6 p-6">
      {/* User Engagement */}
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
                {contentPerformance.popularCourses?.slice(0, 10).map((course: any, index: number) => (
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

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
}

const GamificationTab = ({ t }: { t: any }) => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;

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
              {t('errorLoadingGamificationData')}
            </CardTitle>
            <CardDescription className="text-red-600">
              {t('failedToLoadGamificationMetrics')} {error.message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => mutate()}
              className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              {t('retry')}
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
      <AdvancedGamificationCharts
        metrics={gamificationData}
        isLoading={isLoading}
      />
    </div>
  );
};

const RetentionTab = ({ t }: { t: any }) => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;

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
              {t('errorLoadingRetentionData')}
            </CardTitle>
            <CardDescription className="text-red-600">
              {t('failedToLoadRetentionMetrics')} {error.message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => mutate()}
              className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              {t('retry')}
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
      <UserRetentionCharts
        metrics={retentionData}
        isLoading={isLoading}
      />
    </div>
  );
};

const RealtimeTab = ({ t }: { t: any }) => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;

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
      refreshInterval: 30_000, // Refresh every 30 seconds for real-time data
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
              {t('errorLoadingRealtimeData')}
            </CardTitle>
            <CardDescription className="text-red-600">
              {t('failedToLoadRealtimeMetrics')} {error.message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => mutate()}
              className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              {t('retry')}
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
      <RealtimeMonitoringCharts
        metrics={realtimeData}
        isLoading={isLoading}
      />
    </div>
  );
};

const AlertsTab = ({ t }: { t: any }) => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;

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
      refreshInterval: 60_000, // Refresh every minute for alerts
    },
  );

  const handleBulkAction = async (action: string, userIds: number[]) => {
    try {
      if (!(access_token && org?.id)) {
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
              {t('errorLoadingAlertsData')}
            </CardTitle>
            <CardDescription className="text-red-600">
              {t('failedToLoadSystemAlerts')} {error.message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => mutate()}
              className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              {t('retry')}
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

const CourseFunnelsTab = ({ t }: { t: any }) => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;

  const {
    data: courseFunnelData,
    error,
    isLoading,
  } = useSWR(
    org && access_token ? `admin/course-funnels/${org.id}` : null,
    () => (org && access_token ? getCourseFunnelMetrics(org.id, access_token) : null),
    { refreshInterval: 60_000 },
  );

  if (isLoading) {
    return (
      <AdminSkeleton
        variant="charts"
        count={3}
      />
    );
  }

  if (error || !courseFunnelData) {
    return (
      <div className="space-y-6 p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-500">{t('noCourseFunnelData')}</p>
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

const ActionsTab = ({ t }: { t: any }) => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;
  const { adminSuccess, adminError } = useAdminToast();

  const handleBulkUserOperation = async (action: string, userIds: number[]): Promise<BulkOperationResult> => {
    if (!(org && access_token)) {
      throw new Error('Missing organization or access token');
    }

    try {
      const result = await performBulkUserOperation(org.id, access_token, action, userIds);
      adminSuccess(
        t('bulkOperationCompletedTitle'),
        t('bulkOperationCompletedDescription', { count: result.results.success.length }),
      );
      return result;
    } catch (error) {
      adminError(t('bulkOperationFailedTitle'), t('bulkOperationFailedDescription'));
      throw error;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <AnimatedCard>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {t('administrativeActions')}
          </CardTitle>
          <CardDescription>{t('administrativeActionsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* User Management Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('userManagement')}</CardTitle>
                <CardDescription>{t('userManagementDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-700 transition-colors hover:bg-blue-100"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Users className="mx-auto mb-1 h-4 w-4" />
                    <div className="text-xs">{t('exportUsers')}</div>
                  </motion.button>
                  <motion.button
                    className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-700 transition-colors hover:bg-green-100"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <CheckCircle className="mx-auto mb-1 h-4 w-4" />
                    <div className="text-xs">{t('activateUsers')}</div>
                  </motion.button>
                  <motion.button
                    className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-yellow-700 transition-colors hover:bg-yellow-100"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Clock className="mx-auto mb-1 h-4 w-4" />
                    <div className="text-xs">{t('suspendUsers')}</div>
                  </motion.button>
                  <motion.button
                    className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-purple-700 transition-colors hover:bg-purple-100"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Bell className="mx-auto mb-1 h-4 w-4" />
                    <div className="text-xs">{t('sendNotifications')}</div>
                  </motion.button>
                </div>
              </CardContent>
            </Card>

            {/* System Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('systemOperations')}</CardTitle>
                <CardDescription>{t('systemOperationsDescription')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-700 transition-colors hover:bg-gray-100"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Database className="mx-auto mb-1 h-4 w-4" />
                    <div className="text-xs">{t('backupData')}</div>
                  </motion.button>
                  <motion.button
                    className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-700 transition-colors hover:bg-blue-100"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <HardDrive className="mx-auto mb-1 h-4 w-4" />
                    <div className="text-xs">{t('clearCache')}</div>
                  </motion.button>
                  <motion.button
                    className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-orange-700 transition-colors hover:bg-orange-100"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <TrendingUp className="mx-auto mb-1 h-4 w-4" />
                    <div className="text-xs">{t('generateReports')}</div>
                  </motion.button>
                  <motion.button
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 transition-colors hover:bg-red-100"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <AlertTriangle className="mx-auto mb-1 h-4 w-4" />
                    <div className="text-xs">{t('systemCheck')}</div>
                  </motion.button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Actions Log */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">{t('recentActions')}</CardTitle>
              <CardDescription>{t('recentActionsDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  {
                    action: t('recentAction.bulkUserActivation'),
                    time: t('time.twoHoursAgo'),
                    status: t('status.success'),
                  },
                  { action: t('recentAction.systemBackup'), time: t('time.sixHoursAgo'), status: t('status.success') },
                  { action: t('recentAction.cacheClear'), time: t('time.oneDayAgo'), status: t('status.success') },
                  { action: t('recentAction.userExport'), time: t('time.twoDaysAgo'), status: t('status.success') },
                ].map((action, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <div>
                        <div className="text-sm font-medium">{action.action}</div>
                        <div className="text-xs text-gray-500">{action.time}</div>
                      </div>
                    </div>
                    <div className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">{action.status}</div>
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
  <Card className="transition-all duration-200 hover:scale-[1.02] hover:shadow-md">
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="mb-1 text-sm font-medium text-gray-600">{title}</p>
          <AnimatedCounter
            value={Number.parseInt(value.replace(/,/g, ''), 10) || 0}
            formatter={(v) => v.toLocaleString()}
            className="text-2xl font-bold text-gray-900"
            duration={1.5}
          />
          {trend && (
            <motion.p
              className={`mt-1 text-sm ${trendUp !== false ? 'text-green-600' : 'text-red-600'}`}
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
