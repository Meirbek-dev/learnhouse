import AnalyticsEmptyState from '@components/Dashboard/Analytics/AnalyticsEmptyState';
import AnalyticsThresholdHistogram from '@components/Dashboard/Analytics/AnalyticsThresholdHistogram';
import QuestionDifficultyRadar from '@components/Dashboard/Analytics/QuestionDifficultyRadar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getTeacherAssessmentDetail, normalizeAnalyticsQuery } from '@services/analytics/teacher';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import type { AssessmentType } from '@/types/analytics';
import { auth } from '@/auth';

export default async function AnalyticsAssessmentDetailPage(props: {
  params: Promise<{ orgslug: string; assessmentType: AssessmentType; assessmentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgslug, assessmentType, assessmentId } = await props.params;
  const org = await getOrganizationContextInfo(orgslug);
  const session = await auth();
  const accessToken = session?.tokens?.access_token;
  const query = normalizeAnalyticsQuery(await props.searchParams);

  if (!accessToken) {
    return <AnalyticsEmptyState title="Assessment detail unavailable" description="An authenticated session is required to inspect assessment analytics." />;
  }

  try {
    const detail = await getTeacherAssessmentDetail(org.id ?? org.org_id, assessmentType, Number(assessmentId), accessToken, query);
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 xl:px-8">
        <Card className="border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2"><Badge variant="outline">{detail.assessment_type.replace('_', ' ')}</Badge><Badge variant="outline">Assessment #{detail.assessment_id}</Badge></div>
            <CardTitle className="mt-3 text-3xl">{detail.title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Submission rate</div><div className="mt-2 text-3xl font-semibold">{detail.summary.submission_rate ?? 'n/a'}{detail.summary.submission_rate !== null ? '%' : ''}</div></div>
            <div className="rounded-2xl border border-slate-200 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Pass rate</div><div className="mt-2 text-3xl font-semibold">{detail.summary.pass_rate ?? 'n/a'}{detail.summary.pass_rate !== null ? '%' : ''}</div></div>
            <div className="rounded-2xl border border-slate-200 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Median score</div><div className="mt-2 text-3xl font-semibold">{detail.summary.median_score ?? 'n/a'}{detail.summary.median_score !== null ? '%' : ''}</div></div>
            <div className="rounded-2xl border border-slate-200 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Average attempts</div><div className="mt-2 text-3xl font-semibold">{detail.summary.avg_attempts ?? 'n/a'}</div></div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <AnalyticsThresholdHistogram
            title="Score distribution"
            description="Histogram of learner performance across this assessment."
            data={detail.score_distribution}
            thresholdLabel={detail.assessment_type === 'exam' ? 'Pass threshold from exam settings' : 'Pass threshold: 60%'}
          />
          <AnalyticsThresholdHistogram title="Attempt distribution" description="How many tries learners needed before stopping." data={detail.attempt_distribution} />
        </div>

        {detail.question_breakdown?.length ? <QuestionDifficultyRadar title="Question difficulty" description="Lower accuracy highlights items that may be unclear or too difficult." data={detail.question_breakdown} /> : null}

        <Card className="border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>Common failures</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {detail.common_failures.length ? detail.common_failures.map((failure) => <Badge key={failure.key} variant="outline">{failure.label} · {failure.count}</Badge>) : <div className="text-sm text-slate-500">No common failure cluster detected in the current data.</div>}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>Learner rows</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Learner</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Best score</TableHead>
                  <TableHead>Last score</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.learner_rows.map((row) => (
                  <TableRow key={row.user_id}>
                    <TableCell>{row.user_display_name}</TableCell>
                    <TableCell>{row.attempts}</TableCell>
                    <TableCell>{row.best_score ?? 'n/a'}</TableCell>
                    <TableCell>{row.last_score ?? 'n/a'}</TableCell>
                    <TableCell>{row.submitted_at ? new Date(row.submitted_at).toLocaleString() : 'n/a'}</TableCell>
                    <TableCell>{row.status ?? 'n/a'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    return <AnalyticsEmptyState title="Assessment detail unavailable" description={error instanceof Error ? error.message : 'The assessment analytics detail view could not be loaded.'} />;
  }
}
