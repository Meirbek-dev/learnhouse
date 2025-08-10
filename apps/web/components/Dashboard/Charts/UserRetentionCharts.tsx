'use client';

import { AlertTriangle, BarChart3, Calendar, PieChart, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import type { AdminRetentionMetrics } from '@services/admin/admin';
import { useFormatter, useTranslations } from 'next-intl';
import { Progress } from '@components/ui/progress';
import { Badge } from '@components/ui/badge';

interface UserRetentionChartsProps {
  metrics: AdminRetentionMetrics;
  isLoading?: boolean;
}

export const UserRetentionCharts = ({ metrics, isLoading = false }: UserRetentionChartsProps) => {
  const t = useTranslations('DashPage.Admin.Retention');
  const format = useFormatter();

  const getCohortColor = (retentionRate: number) => {
    if (retentionRate >= 70) return 'bg-green-500';
    if (retentionRate >= 50) return 'bg-yellow-500';
    if (retentionRate >= 30) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getRetentionTrend = (currentRate: number, previousRate: number) => {
    if (currentRate > previousRate) {
      return { icon: TrendingUp, color: 'text-green-600', text: t('trend.improving') };
    }
    if (currentRate < previousRate) {
      return { icon: TrendingDown, color: 'text-red-600', text: t('trend.declining') };
    }
    return { icon: TrendingUp, color: 'text-gray-500', text: t('trend.stable') };
  };

  const formatMonth = (monthStr: string) => {
    try {
      const date = new Date(`${monthStr}-01`);
      return format.dateTime(date, {
        month: 'short',
        year: 'numeric',
      });
    } catch (error) {
      console.warn('Invalid month format in formatMonth:', monthStr, error);
      return monthStr;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="mb-2 h-4 w-1/2 rounded bg-gray-200" />
                  <div className="mb-2 h-8 w-3/4 rounded bg-gray-200" />
                  <div className="h-3 w-1/3 rounded bg-gray-200" />
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
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('totalNewUsers')}</p>
                <p className="text-3xl font-bold">{metrics.overallMetrics.totalNewUsers}</p>
                <p className="text-sm text-gray-500">{t('last6Months')}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('avg30DayRetention')}</p>
                <p className="text-3xl font-bold text-green-600">{metrics.overallMetrics.avg30DayRetention}%</p>
                <div className="mt-1 flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-gray-500">{t('retention')}</span>
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('churnRate')}</p>
                <p className="text-3xl font-bold text-red-600">{metrics.overallMetrics.churnRate}%</p>
                <div className="mt-1 flex items-center gap-1">
                  {metrics.overallMetrics.churnRate > 50 ? (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-green-600" />
                  )}
                  <span className="text-sm text-gray-500">{t('churn')}</span>
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <PieChart className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cohort Analysis */}
      <Tabs
        defaultValue="cohorts"
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="cohorts">{t('cohortAnalysis')}</TabsTrigger>
          <TabsTrigger value="trends">{t('retentionTrends')}</TabsTrigger>
        </TabsList>

        <TabsContent
          value="cohorts"
          className="space-y-4"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {t('cohortRetentionMatrix')}
              </CardTitle>
              <CardDescription>{t('cohortDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {metrics.cohorts.map((cohort, cohortIndex) => (
                  <div
                    key={cohortIndex}
                    className="rounded-lg border p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{formatMonth(cohort.cohortMonth)}</h4>
                        <p className="text-sm text-gray-500">
                          {cohort.newUsers} {t('newUsers')}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {t('cohort')} {cohortIndex + 1}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                      {cohort.retentionData.map((retention, index) => (
                        <div
                          key={index}
                          className="text-center"
                        >
                          <div
                            className={`flex h-12 items-center justify-center rounded-md text-sm font-medium text-white ${getCohortColor(retention.retentionRate)}`}
                          >
                            {retention.retentionRate}%
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {t('month')} {retention.month}
                          </p>
                          <p className="text-xs text-gray-400">
                            {retention.activeUsers} {t('users')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="trends"
          className="space-y-4"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {t('retentionTrendAnalysis')}
              </CardTitle>
              <CardDescription>{t('trendsDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Retention by Month */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <h4 className="mb-3 font-medium">{t('monthlyRetention')}</h4>
                    <div className="space-y-3">
                      {metrics.cohorts.slice(0, 4).map((cohort, index) => {
                        const thirtyDayRetention = cohort.retentionData.find((r) => r.month === 1);
                        const retentionRate = thirtyDayRetention?.retentionRate || 0;

                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between"
                          >
                            <span className="text-sm">{formatMonth(cohort.cohortMonth)}</span>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={retentionRate}
                                className="w-20"
                              />
                              <span className="w-12 text-right text-sm font-medium">{retentionRate}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-3 font-medium">{t('retentionPatterns')}</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-lg bg-green-50 p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full bg-green-500" />
                          <span className="text-sm">{t('highRetention')}</span>
                        </div>
                        <span className="text-sm font-medium">≥70%</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-yellow-50 p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full bg-yellow-500" />
                          <span className="text-sm">{t('moderateRetention')}</span>
                        </div>
                        <span className="text-sm font-medium">50-69%</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-orange-50 p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full bg-orange-500" />
                          <span className="text-sm">{t('lowRetention')}</span>
                        </div>
                        <span className="text-sm font-medium">30-49%</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-red-50 p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full bg-red-500" />
                          <span className="text-sm">{t('criticalRetention')}</span>
                        </div>
                        <span className="text-sm font-medium">&lt;30%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Insights */}
                <div className="border-t pt-4">
                  <h4 className="mb-3 font-medium">{t('keyInsights')}</h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-lg bg-blue-50 p-4">
                      <p className="text-sm font-medium text-blue-900">{t('bestPerformingCohort')}</p>
                      <p className="mt-1 text-xs text-blue-700">
                        {(() => {
                          if (metrics.cohorts.length === 0) return t('noCohortData');

                          const bestCohort = metrics.cohorts.reduce((best, current) => {
                            const currentRetention =
                              current.retentionData.find((r) => r.month === 1)?.retentionRate || 0;
                            const bestRetention = best?.retentionData.find((r) => r.month === 1)?.retentionRate || 0;
                            return currentRetention > bestRetention ? current : best;
                          }, metrics.cohorts[0]);

                          const bestRetention =
                            bestCohort?.retentionData.find((r) => r.month === 1)?.retentionRate || 0;
                          return `${formatMonth(bestCohort?.cohortMonth || '')} - ${bestRetention}% ${t('retention')}`;
                        })()}
                      </p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-4">
                      <p className="text-sm font-medium text-amber-900">{t('improvementOpportunity')}</p>
                      <p className="mt-1 text-xs text-amber-700">
                        {metrics.overallMetrics.churnRate > 50 ? t('highChurnAlert') : t('retentionGood')}
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

export default UserRetentionCharts;
