'use client';

import type { AnalyticsQuery, TeacherOverviewResponse, TeacherCourseRow, AssessmentOutlierRow } from '@/types/analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TeacherFilterBar from './TeacherFilterBar';
import TeacherKpiCards from './TeacherKpiCards';
import AnalyticsMultiSeriesTrendChart from './AnalyticsMultiSeriesTrendChart';
import AnalyticsRiskDistributionChart from './AnalyticsRiskDistributionChart';
import AtRiskLearnersTable from './AtRiskLearnersTable';
import GradingBacklogPanel from './GradingBacklogPanel';
import CourseHealthTable from './CourseHealthTable';
import AssessmentOutliersTable from './AssessmentOutliersTable';
import AnalyticsExportButton from './AnalyticsExportButton';
import { getAnalyticsExportUrl } from '@services/analytics/teacher';
import type { AnalyticsFilterOption } from '@/types/analytics';

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

export default function TeacherOverview({ orgslug, orgId, query, data, courseRows, assessmentRows, courseOptions = [], cohortOptions = [] }: TeacherOverviewProps) {
  const trendData = data.trends.active_learners.map((point, index) => ({
    bucket: new Date(point.bucket_start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    active_learners: point.value,
    completions: data.trends.completions[index]?.value ?? 0,
    submissions: data.trends.submissions[index]?.value ?? 0,
    grading_completed: data.trends.grading_completed[index]?.value ?? 0,
  }));

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 xl:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.16),_transparent_26%),linear-gradient(180deg,_#ffffff,_#f8fafc_56%,_#ecfdf5)] p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Teacher Analytics</div>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">Operational analytics for course engagement, learner risk, and assessment quality.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
              This dashboard is scoped to the teacher&apos;s managed courses and exposes intervention-ready metrics instead of passive charts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AnalyticsExportButton href={getAnalyticsExportUrl(orgId, 'at-risk', query)} label="Export at-risk learners" />
            <AnalyticsExportButton href={getAnalyticsExportUrl(orgId, 'grading-backlog', query)} label="Export grading backlog" />
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

      <TeacherKpiCards
        metrics={[
          data.summary.active_learners,
          data.summary.returning_learners,
          data.summary.completion_rate,
          data.summary.at_risk_learners,
          data.summary.ungraded_submissions,
          data.summary.negative_engagement_courses,
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <AnalyticsMultiSeriesTrendChart title="Engagement and execution trend" description="Active learners, completions, submissions, and completed grading across the selected window." data={trendData} />
        <GradingBacklogPanel backlogCount={data.summary.ungraded_submissions.value} alerts={data.alerts} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <AnalyticsRiskDistributionChart rows={data.at_risk_preview} />
        <Card className="border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>Freshness and scope</CardTitle>
            <CardDescription>Data provenance for the current analytics view.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Generated</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{new Date(data.generated_at).toLocaleString()}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Freshness</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{data.freshness_seconds}s</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Scoped courses</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{data.scope.course_ids.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Cohorts</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{data.scope.cohort_ids.length || 'All'}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle>Alerts</CardTitle>
          <CardDescription>Prioritized operational signals derived from the current scope.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.alerts.length ? data.alerts.map((alert) => (
            <div key={alert.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Badge variant={alert.severity === 'critical' ? 'destructive' : alert.severity === 'warning' ? 'warning' : 'outline'}>{alert.severity}</Badge>
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{alert.type.replace('_', ' ')}</span>
              </div>
              <div className="font-medium text-slate-900">{alert.title}</div>
              <div className="mt-2 text-sm leading-6 text-slate-600">{alert.body}</div>
            </div>
          )) : <div className="text-sm text-slate-500">No active alerts for the selected filter set.</div>}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <CourseHealthTable orgslug={orgslug} rows={courseRows.slice(0, 8)} />
        <AssessmentOutliersTable orgslug={orgslug} rows={assessmentRows.slice(0, 8)} />
      </div>

      <AtRiskLearnersTable rows={data.at_risk_preview} title="Urgent learner watchlist" description="Top-ranked learners who likely need outreach this week." />
    </div>
  );
}
