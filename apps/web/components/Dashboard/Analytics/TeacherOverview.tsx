'use client';

import type { AnalyticsQuery, TeacherOverviewResponse, TeacherCourseRow, AssessmentOutlierRow } from '@/types/analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TeacherFilterBar from './TeacherFilterBar';
import TeacherKpiCards from './TeacherKpiCards';
import EngagementAreaChart from './EngagementAreaChart';
import AtRiskLearnersTable from './AtRiskLearnersTable';
import GradingBacklogPanel from './GradingBacklogPanel';
import CourseHealthTable from './CourseHealthTable';
import AssessmentOutliersTable from './AssessmentOutliersTable';
import AnalyticsExportButton from './AnalyticsExportButton';
import { getAnalyticsExportUrl } from '@services/analytics/teacher';

interface TeacherOverviewProps {
  orgslug: string;
  orgId: number;
  query: AnalyticsQuery;
  data: TeacherOverviewResponse;
  courseRows: TeacherCourseRow[];
  assessmentRows: AssessmentOutlierRow[];
}

export default function TeacherOverview({ orgslug, orgId, query, data, courseRows, assessmentRows }: TeacherOverviewProps) {
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

      <TeacherFilterBar orgslug={orgslug} query={query} courseCount={data.scope.course_ids.length} />

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
        <EngagementAreaChart title="Active learner trend" description="Distinct active learners across the selected analytics window." data={data.trends.active_learners} />
        <GradingBacklogPanel backlogCount={data.summary.ungraded_submissions.value} alerts={data.alerts} />
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
