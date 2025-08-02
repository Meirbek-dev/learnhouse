'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Badge } from '@components/ui/badge';
import { Progress } from '@components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Alert, AlertDescription } from '@components/ui/alert';
import {
  BarChart3,
  TrendingDown,
  Users,
  BookOpen,
  CheckCircle,
  AlertTriangle,
  Target,
  ArrowDown
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { AdminCourseFunnelsMetrics, CourseFunnel } from '@services/admin/admin';

interface CourseFunnelChartsProps {
  metrics: AdminCourseFunnelsMetrics;
  isLoading?: boolean;
  onCourseSelect?: (courseId: number | null) => void;
}

export const CourseFunnelCharts = ({
  metrics,
  isLoading = false,
  onCourseSelect
}: CourseFunnelChartsProps) => {
  const t = useTranslations('DashPage.Admin.Funnels');
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  const selectedFunnel = selectedCourseId
    ? metrics.funnels.find(f => f.courseId === selectedCourseId)
    : null;

  const getDropoffSeverity = (dropoffRate: number) => {
    if (dropoffRate > 70) return { color: 'text-red-600', bg: 'bg-red-50', severity: 'high' };
    if (dropoffRate > 50) return { color: 'text-orange-600', bg: 'bg-orange-50', severity: 'medium' };
    if (dropoffRate > 30) return { color: 'text-yellow-600', bg: 'bg-yellow-50', severity: 'medium' };
    return { color: 'text-green-600', bg: 'bg-green-50', severity: 'low' };
  };

  const getStageIcon = (stageName: string) => {
    switch (stageName.toLowerCase()) {
      case 'enrolled':
        return <Users className="h-5 w-5 text-blue-600" />;
      case 'started':
        return <BookOpen className="h-5 w-5 text-purple-600" />;
      case '50% complete':
        return <Target className="h-5 w-5 text-orange-600" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      default:
        return <BarChart3 className="h-5 w-5 text-gray-600" />;
    }
  };

  const handleCourseChange = (courseId: string) => {
    const newCourseId = courseId === 'all' ? null : parseInt(courseId);
    setSelectedCourseId(newCourseId);
    onCourseSelect?.(newCourseId);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Course Selection */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{t('title')}</h2>
          <p className="text-sm text-gray-600">{t('description')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedCourseId?.toString() || 'all'} onValueChange={handleCourseChange}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder={t('selectCourse')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allCourses')}</SelectItem>
              {metrics.funnels.map((funnel) => (
                <SelectItem key={funnel.courseId} value={funnel.courseId.toString()}>
                  {funnel.courseName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('totalCourses')}</p>
                <p className="text-3xl font-bold">{metrics.summary.totalCourses}</p>
              </div>
              <BookOpen className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('avgCompletionRate')}</p>
                <p className="text-3xl font-bold text-green-600">
                  {metrics.summary.avgCompletionRate}%
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('coursesAnalyzed')}</p>
                <p className="text-3xl font-bold text-purple-600">
                  {selectedFunnel ? 1 : metrics.funnels.length}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funnel Visualization */}
      {selectedFunnel ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {t('funnelAnalysis')}: {selectedFunnel.courseName}
            </CardTitle>
            <CardDescription>
              {t('singleFunnelDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {selectedFunnel.stages.map((stage, index) => {
                const isLast = index === selectedFunnel.stages.length - 1;
                const dropoffSeverity = getDropoffSeverity(stage.dropoffRate);

                return (
                  <div key={index} className="relative">
                    {/* Stage Card */}
                    <div className="flex items-center gap-6 p-6 border rounded-lg bg-white">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center justify-center h-12 w-12 rounded-full bg-gray-100">
                          {getStageIcon(stage.name)}
                        </div>

                        <div className="flex-1">
                          <h4 className="font-semibold text-lg">{stage.name}</h4>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-gray-500" />
                              <span className="text-sm text-gray-600">
                                {stage.users.toLocaleString()} {t('users')}
                              </span>
                            </div>
                            <Badge variant="outline" className="text-sm">
                              {stage.percentage}%
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-32">
                        <Progress
                          value={stage.percentage}
                          className="h-3"
                        />
                        <p className="text-xs text-center mt-1 text-gray-500">
                          {stage.percentage}%
                        </p>
                      </div>
                    </div>

                    {/* Dropoff Indicator */}
                    {!isLast && (
                      <div className="flex items-center justify-center my-2">
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${dropoffSeverity.bg}`}>
                          <ArrowDown className={`h-4 w-4 ${dropoffSeverity.color}`} />
                          <span className={`text-sm font-medium ${dropoffSeverity.color}`}>
                            {stage.dropoffRate}% {t('dropoff')}
                          </span>
                          {stage.dropoffRate > 50 && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Insights */}
            <div className="mt-6 pt-6 border-t">
              <h4 className="font-medium mb-3">{t('insights')}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(() => {
                  const highestDropoff = selectedFunnel.stages.reduce((max, stage) =>
                    stage.dropoffRate > max.dropoffRate ? stage : max
                  );

                  const completionRate = selectedFunnel.stages[selectedFunnel.stages.length - 1]?.percentage || 0;

                  return (
                    <>
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>{t('biggestDropoff')}:</strong> {highestDropoff.dropoffRate}% {t('atStage')} "{highestDropoff.name}"
                        </AlertDescription>
                      </Alert>

                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>{t('overallCompletion')}:</strong> {completionRate}% {t('completionRate')}
                          {completionRate > 50 ? ` - ${t('good')}` : ` - ${t('needsImprovement')}`}
                        </AlertDescription>
                      </Alert>
                    </>
                  );
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t('allCoursesFunnels')}
            </CardTitle>
            <CardDescription>
              {t('overviewDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.funnels.map((funnel) => {
                const completionRate = funnel.stages[funnel.stages.length - 1]?.percentage || 0;
                const enrolledUsers = funnel.stages[0]?.users || 0;
                const completedUsers = funnel.stages[funnel.stages.length - 1]?.users || 0;

                return (
                  <div
                    key={funnel.courseId}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleCourseChange(funnel.courseId.toString())}
                  >
                    <div className="flex items-center gap-4">
                      <BookOpen className="h-8 w-8 text-blue-600" />
                      <div>
                        <h4 className="font-medium">{funnel.courseName}</h4>
                        <p className="text-sm text-gray-500">
                          {enrolledUsers} {t('enrolled')} • {completedUsers} {t('completed')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-24">
                        <Progress value={completionRate} className="h-2" />
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{completionRate}%</p>
                        <p className="text-sm text-gray-500">{t('completion')}</p>
                      </div>
                      <Badge
                        variant={completionRate > 50 ? "default" : "destructive"}
                        className="ml-2"
                      >
                        {completionRate > 50 ? t('good') : t('poor')}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {t('recommendations')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.summary.avgCompletionRate < 30 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {t('lowCompletionAlert')}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h5 className="font-medium text-blue-900 mb-2">{t('improvementTips')}</h5>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• {t('tip1')}</li>
                  <li>• {t('tip2')}</li>
                  <li>• {t('tip3')}</li>
                </ul>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <h5 className="font-medium text-green-900 mb-2">{t('bestPractices')}</h5>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• {t('practice1')}</li>
                  <li>• {t('practice2')}</li>
                  <li>• {t('practice3')}</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CourseFunnelCharts;
