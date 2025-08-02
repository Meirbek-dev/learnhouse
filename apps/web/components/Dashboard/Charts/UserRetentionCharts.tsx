'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Badge } from '@components/ui/badge';
import { Progress } from '@components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import {
  TrendingDown,
  TrendingUp,
  Users,
  Calendar,
  BarChart3,
  PieChart,
  AlertTriangle
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AdminRetentionMetrics } from '@services/admin/admin';

interface UserRetentionChartsProps {
  metrics: AdminRetentionMetrics;
  isLoading?: boolean;
}

export const UserRetentionCharts = ({ metrics, isLoading = false }: UserRetentionChartsProps) => {
  const t = useTranslations('DashPage.Admin.Retention');

  const getCohortColor = (retentionRate: number) => {
    if (retentionRate >= 70) return 'bg-green-500';
    if (retentionRate >= 50) return 'bg-yellow-500';
    if (retentionRate >= 30) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getRetentionTrend = (currentRate: number, previousRate: number) => {
    if (currentRate > previousRate) {
      return { icon: TrendingUp, color: 'text-green-600', text: 'improving' };
    } else if (currentRate < previousRate) {
      return { icon: TrendingDown, color: 'text-red-600', text: 'declining' };
    }
    return { icon: TrendingUp, color: 'text-gray-500', text: 'stable' };
  };

  const formatMonth = (monthStr: string) => {
    const date = new Date(monthStr + '-01');
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('totalNewUsers')}</p>
                <p className="text-3xl font-bold">{metrics.overallMetrics.totalNewUsers}</p>
                <p className="text-sm text-gray-500">{t('last6Months')}</p>
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
                <p className="text-sm font-medium text-gray-600">{t('avg30DayRetention')}</p>
                <p className="text-3xl font-bold text-green-600">
                  {metrics.overallMetrics.avg30DayRetention}%
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-gray-500">{t('retention')}</span>
                </div>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
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
                <p className="text-3xl font-bold text-red-600">
                  {metrics.overallMetrics.churnRate}%
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {metrics.overallMetrics.churnRate > 50 ? (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-green-600" />
                  )}
                  <span className="text-sm text-gray-500">{t('churn')}</span>
                </div>
              </div>
              <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                <PieChart className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cohort Analysis */}
      <Tabs defaultValue="cohorts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="cohorts">{t('cohortAnalysis')}</TabsTrigger>
          <TabsTrigger value="trends">{t('retentionTrends')}</TabsTrigger>
        </TabsList>

        <TabsContent value="cohorts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {t('cohortRetentionMatrix')}
              </CardTitle>
              <CardDescription>
                {t('cohortDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {metrics.cohorts.map((cohort, cohortIndex) => (
                  <div key={cohortIndex} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
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

                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                      {cohort.retentionData.map((retention, index) => (
                        <div key={index} className="text-center">
                          <div
                            className={`h-12 rounded-md flex items-center justify-center text-white text-sm font-medium ${getCohortColor(retention.retentionRate)}`}
                          >
                            {retention.retentionRate}%
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
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

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {t('retentionTrendAnalysis')}
              </CardTitle>
              <CardDescription>
                {t('trendsDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Retention by Month */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">{t('monthlyRetention')}</h4>
                    <div className="space-y-3">
                      {metrics.cohorts.slice(0, 4).map((cohort, index) => {
                        const thirtyDayRetention = cohort.retentionData.find(r => r.month === 1);
                        const retentionRate = thirtyDayRetention?.retentionRate || 0;

                        return (
                          <div key={index} className="flex items-center justify-between">
                            <span className="text-sm">{formatMonth(cohort.cohortMonth)}</span>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={retentionRate}
                                className="w-20"
                              />
                              <span className="text-sm font-medium w-12 text-right">
                                {retentionRate}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">{t('retentionPatterns')}</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="text-sm">{t('highRetention')}</span>
                        </div>
                        <span className="text-sm font-medium">≥70%</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                          <span className="text-sm">{t('moderateRetention')}</span>
                        </div>
                        <span className="text-sm font-medium">50-69%</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                          <span className="text-sm">{t('lowRetention')}</span>
                        </div>
                        <span className="text-sm font-medium">30-49%</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <span className="text-sm">{t('criticalRetention')}</span>
                        </div>
                        <span className="text-sm font-medium">&lt;30%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Insights */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">{t('keyInsights')}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-blue-900">{t('bestPerformingCohort')}</p>
                      <p className="text-xs text-blue-700 mt-1">
                        {(() => {
                          if (metrics.cohorts.length === 0) return 'No cohort data available';

                          const bestCohort = metrics.cohorts.reduce((best, current) => {
                            const currentRetention = current.retentionData.find(r => r.month === 1)?.retentionRate || 0;
                            const bestRetention = best?.retentionData.find(r => r.month === 1)?.retentionRate || 0;
                            return currentRetention > bestRetention ? current : best;
                          }, metrics.cohorts[0]);

                          const bestRetention = bestCohort?.retentionData.find(r => r.month === 1)?.retentionRate || 0;
                          return `${formatMonth(bestCohort?.cohortMonth || '')} - ${bestRetention}% retention`;
                        })()}
                      </p>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-lg">
                      <p className="text-sm font-medium text-amber-900">{t('improvementOpportunity')}</p>
                      <p className="text-xs text-amber-700 mt-1">
                        {metrics.overallMetrics.churnRate > 50
                          ? t('highChurnAlert')
                          : t('retentionGood')
                        }
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
