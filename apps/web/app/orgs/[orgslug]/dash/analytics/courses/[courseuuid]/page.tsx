import AnalyticsEmptyState from '@components/Dashboard/Analytics/AnalyticsEmptyState';
import AssessmentOutliersTable from '@components/Dashboard/Analytics/AssessmentOutliersTable';
import AtRiskLearnersTable from '@components/Dashboard/Analytics/AtRiskLearnersTable';
import CompletionFunnelChart from '@components/Dashboard/Analytics/CompletionFunnelChart';
import EngagementAreaChart from '@components/Dashboard/Analytics/EngagementAreaChart';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getTeacherCourseDetail, getTeacherCourseList, normalizeAnalyticsQuery } from '@services/analytics/teacher';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { auth } from '@/auth';
import { notFound } from 'next/navigation';

export default async function AnalyticsCourseDetailPage(props: {
  params: Promise<{ orgslug: string; courseuuid: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgslug, courseuuid } = await props.params;
  const org = await getOrganizationContextInfo(orgslug);
  const session = await auth();
  const accessToken = session?.tokens?.access_token;
  const query = normalizeAnalyticsQuery(await props.searchParams);

  if (!accessToken) {
    return <AnalyticsEmptyState title="Course detail unavailable" description="An authenticated session is required to inspect course analytics." />;
  }

  try {
    const courseList = await getTeacherCourseList(org.id ?? org.org_id, accessToken, query);
    const courseRow = courseList.items.find((item) => item.course_uuid === courseuuid);
    if (!courseRow) {
      notFound();
    }
    const detail = await getTeacherCourseDetail(org.id ?? org.org_id, courseRow.course_id, accessToken, query);
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 xl:px-8">
        <Card className="border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
              <Badge variant="outline">Course detail</Badge>
              <Badge variant="outline">{detail.course.course_uuid}</Badge>
            </div>
            <CardTitle className="mt-3 text-3xl">{detail.course.name}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Completion</div><div className="mt-2 text-3xl font-semibold">{detail.summary.completion_rate}%</div></div>
            <div className="rounded-2xl border border-slate-200 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Average progress</div><div className="mt-2 text-3xl font-semibold">{detail.summary.avg_progress_pct}%</div></div>
            <div className="rounded-2xl border border-slate-200 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Ungraded submissions</div><div className="mt-2 text-3xl font-semibold">{detail.summary.ungraded_submissions}</div></div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <EngagementAreaChart title="Engagement trend" description="Distinct active learners over time for this course." data={detail.engagement_trend} />
          <CompletionFunnelChart title="Completion funnel" description="Enrollment to active to completion conversion for this course." data={detail.funnels.course_completion} />
        </div>

        <CompletionFunnelChart title="Chapter drop-off" description="Progress counts by ordered chapter to expose drop-off points." data={detail.funnels.chapter_dropoff} />

        <Card className="border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>Content health</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {detail.content_health.map((item) => (
              <div key={item.signal} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-2"><Badge variant={item.severity === 'critical' ? 'destructive' : item.severity === 'warning' ? 'warning' : 'outline'}>{item.severity}</Badge><span className="text-sm font-medium text-slate-800">{item.signal}</span></div>
                <div className="mt-3 text-sm leading-6 text-slate-600">{item.note}</div>
                {item.value !== null ? <div className="mt-3 text-2xl font-semibold text-slate-900">{item.value}</div> : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <AssessmentOutliersTable orgslug={orgslug} rows={detail.assessment_outliers} />
        <AtRiskLearnersTable rows={detail.at_risk_learners} title="At-risk learners in this course" description="Highest-risk learners scoped to the selected course." />
      </div>
    );
  } catch (error) {
    return <AnalyticsEmptyState title="Course detail unavailable" description={error instanceof Error ? error.message : 'The course analytics detail view could not be loaded.'} />;
  }
}
