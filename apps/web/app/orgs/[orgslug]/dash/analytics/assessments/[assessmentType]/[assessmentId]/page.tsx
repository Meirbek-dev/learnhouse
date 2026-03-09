import AnalyticsEmptyState from '@components/Dashboard/Analytics/AnalyticsEmptyState';
import AnalyticsThresholdHistogram from '@components/Dashboard/Analytics/AnalyticsThresholdHistogram';
import QuestionDifficultyRadar from '@components/Dashboard/Analytics/QuestionDifficultyRadar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getAnalyticsAssessmentTypeLabel, getAnalyticsStatusLabel } from '@/lib/analytics/labels';
import { getTeacherAssessmentDetail, normalizeAnalyticsQuery } from '@services/analytics/teacher';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import type { AssessmentType } from '@/types/analytics';
import { auth } from '@/auth';
import { getLocale, getTranslations } from 'next-intl/server';

export default async function AnalyticsAssessmentDetailPage(props: {
  params: Promise<{ orgslug: string; assessmentType: AssessmentType; assessmentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgslug, assessmentType, assessmentId } = await props.params;
  const org = await getOrganizationContextInfo(orgslug);
  const session = await auth();
  const accessToken = session?.tokens?.access_token;
  const query = normalizeAnalyticsQuery(await props.searchParams);
  const locale = await getLocale();
  const t = await getTranslations('TeacherAnalytics');

  if (!accessToken) {
    return <AnalyticsEmptyState title={t('pages.assessmentDetailTitle')} description={t('pages.assessmentDetailDesc')} />;
  }

  try {
    const detail = await getTeacherAssessmentDetail(org.id ?? org.org_id, assessmentType, Number(assessmentId), accessToken, query);
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6 xl:px-8">
        <Card className="border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2"><Badge variant="outline">{getAnalyticsAssessmentTypeLabel(t, detail.assessment_type)}</Badge><Badge variant="outline">{t('pages.assessmentDetailBadge', { id: detail.assessment_id })}</Badge></div>
            <CardTitle className="mt-3 text-3xl">{detail.title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">{t('pages.assessmentStatSubmissionRate')}</div><div className="mt-2 text-3xl font-semibold">{detail.summary.submission_rate ?? t('atRisk.na')}{detail.summary.submission_rate !== null ? '%' : ''}</div></div>
            <div className="rounded-2xl border border-slate-200 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">{t('pages.assessmentStatPassRate')}</div><div className="mt-2 text-3xl font-semibold">{detail.summary.pass_rate ?? t('atRisk.na')}{detail.summary.pass_rate !== null ? '%' : ''}</div></div>
            <div className="rounded-2xl border border-slate-200 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">{t('pages.assessmentStatMedianScore')}</div><div className="mt-2 text-3xl font-semibold">{detail.summary.median_score ?? t('atRisk.na')}{detail.summary.median_score !== null ? '%' : ''}</div></div>
            <div className="rounded-2xl border border-slate-200 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">{t('pages.assessmentStatAvgAttempts')}</div><div className="mt-2 text-3xl font-semibold">{detail.summary.avg_attempts ?? t('atRisk.na')}</div></div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <AnalyticsThresholdHistogram
            title={t('pages.assessmentScoreDistTitle')}
            description={t('pages.assessmentScoreDistDesc')}
            data={detail.score_distribution}
            thresholdLabel={detail.pass_threshold !== null ? `${t('pages.assessmentPassThresholdDefault')} ${detail.pass_threshold}%` : undefined}
            thresholdBucketLabel={detail.pass_threshold_bucket_label || undefined}
          />
          <AnalyticsThresholdHistogram title={t('pages.assessmentAttemptDistTitle')} description={t('pages.assessmentAttemptDistDesc')} data={detail.attempt_distribution} />
        </div>

        {detail.question_breakdown?.length ? <QuestionDifficultyRadar title={t('pages.assessmentQuestionTitle')} description={t('pages.assessmentQuestionDesc')} data={detail.question_breakdown} /> : null}

        <Card className="border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>{t('pages.assessmentCommonFailuresTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {detail.common_failures.length ? detail.common_failures.map((failure) => <Badge key={failure.key} variant="outline">{failure.label} · {failure.count}</Badge>) : <div className="text-sm text-slate-500">{t('pages.assessmentNoCommonFailures')}</div>}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle>{t('pages.assessmentLearnerRowsTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('pages.assessmentColLearner')}</TableHead>
                  <TableHead>{t('pages.assessmentColAttempts')}</TableHead>
                  <TableHead>{t('pages.assessmentColBestScore')}</TableHead>
                  <TableHead>{t('pages.assessmentColLastScore')}</TableHead>
                  <TableHead>{t('pages.assessmentColSubmitted')}</TableHead>
                  <TableHead>{t('pages.assessmentColStatus')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.learner_rows.map((row) => (
                  <TableRow key={row.user_id}>
                    <TableCell>{row.user_display_name}</TableCell>
                    <TableCell>{row.attempts}</TableCell>
                    <TableCell>{row.best_score ?? t('atRisk.na')}</TableCell>
                    <TableCell>{row.last_score ?? t('atRisk.na')}</TableCell>
                    <TableCell>{row.submitted_at ? new Date(row.submitted_at).toLocaleString(locale) : t('atRisk.na')}</TableCell>
                    <TableCell>{getAnalyticsStatusLabel(t, row.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    return <AnalyticsEmptyState title={t('pages.assessmentDetailTitle')} description={error instanceof Error ? error.message : t('pages.assessmentDetailLoadError')} />;
  }
}

