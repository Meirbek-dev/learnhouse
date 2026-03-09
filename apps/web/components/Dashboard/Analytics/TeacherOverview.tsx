'use client';

import type {
  AnalyticsQuery,
  TeacherOverviewResponse,
  TeacherCourseRow,
  AssessmentOutlierRow,
} from '@/types/analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAnalyticsAlertTypeLabel, getAnalyticsSeverityLabel } from '@/lib/analytics/labels';
import AnalyticsRiskDistributionChart from './AnalyticsRiskDistributionChart';
import AnalyticsMultiSeriesTrendChart from './AnalyticsMultiSeriesTrendChart';
import { getAnalyticsExportUrl } from '@services/analytics/teacher';
import AssessmentOutliersTable from './AssessmentOutliersTable';
import type { AnalyticsFilterOption } from '@/types/analytics';
import AnalyticsExportButton from './AnalyticsExportButton';
import GradingBacklogPanel from './GradingBacklogPanel';
import AtRiskLearnersTable from './AtRiskLearnersTable';
import { useLocale, useTranslations } from 'next-intl';
import CourseHealthTable from './CourseHealthTable';
import TeacherFilterBar from './TeacherFilterBar';
import TeacherKpiCharts from './TeacherKpiCharts';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface TeacherOverviewProps {
  orgslug: string;
  orgId: number;
  query: AnalyticsQuery;
  data: TeacherOverviewResponse;
  courseRows: TeacherCourseRow[];
  assessmentRows: AssessmentOutlierRow[];
  courseOptions?: AnalyticsFilterOption[];
  cohortOptions?: AnalyticsFilterOption[];
}

export default function TeacherOverview({
  orgslug,
  orgId,
  query,
  data,
  courseRows,
  assessmentRows,
  courseOptions = [],
  cohortOptions = [],
}: TeacherOverviewProps) {
  const t = useTranslations('TeacherAnalytics');
  const locale = useLocale();

  function formatFreshness(seconds: number): string {
    if (seconds <= 0) return t('freshness.live');
    if (seconds < 60) return t('freshness.seconds', { seconds });
    if (seconds < 3600) return t('freshness.minutes', { minutes: Math.round(seconds / 60) });
    if (seconds < 86400) return t('freshness.hours', { hours: Math.round(seconds / 3600) });
    return t('freshness.days', { days: Math.round(seconds / 86400) });
  }

  // Align multi-series trend data by bucket_start timestamp to avoid index misalignment
  const completionsMap = new Map(data.trends.completions.map((p) => [p.bucket_start, p.value]));
  const submissionsMap = new Map(data.trends.submissions.map((p) => [p.bucket_start, p.value]));
  const gradingMap = new Map(data.trends.grading_completed.map((p) => [p.bucket_start, p.value]));
  const trendData = data.trends.active_learners.map((point) => ({
    bucket: new Date(point.bucket_start).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
    active_learners: point.value,
    completions: completionsMap.get(point.bucket_start) ?? 0,
    submissions: submissionsMap.get(point.bucket_start) ?? 0,
    grading_completed: gradingMap.get(point.bucket_start) ?? 0,
  }));

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 xl:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              {t('overview.label')}
            </div>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
              {t('overview.heading')}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">{t('overview.description')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AnalyticsExportButton
              href={getAnalyticsExportUrl(orgId, 'at-risk', query)}
              label={t('overview.exportAtRisk')}
            />
            <AnalyticsExportButton
              href={getAnalyticsExportUrl(orgId, 'grading-backlog', query)}
              label={t('overview.exportGradingBacklog')}
            />
          </div>
        </div>
      </section>

      <TeacherFilterBar
        orgslug={orgslug}
        query={query}
        courseCount={data.scope.course_ids.length}
        courseOptions={courseOptions}
        cohortOptions={cohortOptions}
      />

      <TeacherKpiCharts
        metrics={data.summary}
        trends={data.trends}
      />

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <AnalyticsMultiSeriesTrendChart
          title={t('overview.trendTitle')}
          description={t('overview.trendDescription')}
          data={trendData}
        />
        <GradingBacklogPanel
          backlogCount={data.summary.ungraded_submissions.value}
          alerts={data.alerts}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <AnalyticsRiskDistributionChart
          rows={data.at_risk_preview}
          totalAtRisk={data.summary.at_risk_learners.value}
        />
        <Card className="border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>{t('overview.freshnessTitle')}</CardTitle>
            <CardDescription>{t('overview.freshnessDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('overview.labelGenerated')}</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">
                {new Date(data.generated_at).toLocaleString(locale)}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('overview.labelFreshness')}</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{formatFreshness(data.freshness_seconds)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                {t('overview.labelScopedCourses')}
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{data.scope.course_ids.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{t('overview.labelCohorts')}</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">
                {data.scope.cohort_ids.length || t('overview.cohortsAll')}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle>{t('overview.alertsTitle')}</CardTitle>
          <CardDescription>{t('overview.alertsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.alerts.length ? (
            data.alerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Badge
                    variant={
                      alert.severity === 'critical'
                        ? 'destructive'
                        : alert.severity === 'warning'
                          ? 'warning'
                          : 'outline'
                    }
                  >
                    {getAnalyticsSeverityLabel(t, alert.severity)}
                  </Badge>
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    {getAnalyticsAlertTypeLabel(t, alert.type)}
                  </span>
                </div>
                <div className="font-medium text-slate-900">{alert.title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-600">{alert.body}</div>
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-500">{t('overview.alertsEmpty')}</div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        <div>
          <CourseHealthTable
            orgslug={orgslug}
            rows={courseRows.slice(0, 8)}
          />
          {courseRows.length > 8 && (
            <p className="mt-2 text-sm text-slate-500">
              {t('overview.showingCourses', { total: courseRows.length })}{' '}
              <Link
                href={`/orgs/${orgslug}/dash/analytics/courses`}
                className="text-blue-600 hover:underline"
              >
                {t('overview.viewAllCourses')}
              </Link>
            </p>
          )}
        </div>
        <div>
          <AssessmentOutliersTable
            orgslug={orgslug}
            rows={assessmentRows.slice(0, 8)}
          />
          {assessmentRows.length > 8 && (
            <p className="mt-2 text-sm text-slate-500">
              {t('overview.showingAssessments', { total: assessmentRows.length })}{' '}
              <Link
                href={`/orgs/${orgslug}/dash/analytics/assessments`}
                className="text-blue-600 hover:underline"
              >
                {t('overview.viewAllAssessments')}
              </Link>
            </p>
          )}
        </div>
      </div>

      <AtRiskLearnersTable
        rows={data.at_risk_preview}
        title={t('overview.watchlistTitle')}
        description={t('overview.watchlistDescription')}
      />
    </div>
  );
}
