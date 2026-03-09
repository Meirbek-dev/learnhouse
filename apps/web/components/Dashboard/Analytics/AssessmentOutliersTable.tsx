'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { AssessmentOutlierRow } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAnalyticsAssessmentTypeLabel, getAnalyticsReasonCodeLabel } from '@/lib/analytics/labels';
import AnalyticsDataTable from './AnalyticsDataTable';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface AssessmentOutliersTableProps {
  orgslug: string;
  rows: AssessmentOutlierRow[];
}

export default function AssessmentOutliersTable({ orgslug, rows }: AssessmentOutliersTableProps) {
  const t = useTranslations('TeacherAnalytics');
  const columns: ColumnDef<AssessmentOutlierRow>[] = [
    {
      accessorKey: 'title',
      header: t('assessmentOutliers.colAssessment'),
      cell: ({ row }) => (
        <div>
          <Link
            href={`/orgs/${orgslug}/dash/analytics/assessments/${row.original.assessment_type}/${row.original.assessment_id}`}
            className="font-medium text-slate-900 hover:text-emerald-700"
          >
            {row.original.title}
          </Link>
          <div className="text-xs uppercase tracking-wide text-slate-500">{getAnalyticsAssessmentTypeLabel(t, row.original.assessment_type)}</div>
        </div>
      ),
    },
    { accessorKey: 'course_name', header: t('assessmentOutliers.colCourse') },
    {
      accessorKey: 'submission_rate',
      header: t('assessmentOutliers.colSubmission'),
      cell: ({ row }) => (row.original.submission_rate === null ? t('atRisk.na') : `${row.original.submission_rate}%`),
    },
    {
      accessorKey: 'pass_rate',
      header: t('assessmentOutliers.colPass'),
      cell: ({ row }) => (row.original.pass_rate === null ? t('atRisk.na') : `${row.original.pass_rate}%`),
    },
    {
      accessorKey: 'median_score',
      header: t('assessmentOutliers.colMedian'),
      cell: ({ row }) => (row.original.median_score === null ? t('atRisk.na') : `${row.original.median_score}%`),
    },
    {
      accessorKey: 'difficulty_score',
      header: t('assessmentOutliers.colDifficulty'),
      cell: ({ row }) => {
        const v = row.original.difficulty_score;
        if (v === null) return t('atRisk.na');
        // difficulty_score is on a 0–1 scale where 1 = hardest
        return `${Math.round(v * 100)}%`;
      },
    },
    {
      accessorKey: 'outlier_reason_codes',
      header: t('assessmentOutliers.colSignals'),
      cell: ({ row }) =>
        row.original.outlier_reason_codes.length ? (
          <div className="max-w-[240px] whitespace-normal text-xs text-slate-600">
            {row.original.outlier_reason_codes.map((code) => (
              <Badge key={code} variant="outline" className="mb-1 mr-1">
                {getAnalyticsReasonCodeLabel(t, code)}
              </Badge>
            ))}
          </div>
        ) : (
          t('assessmentOutliers.healthy')
        ),
    },
  ];

  return (
    <Card className="border-slate-200 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle>{t('assessmentOutliers.title')}</CardTitle>
        <CardDescription>{t('assessmentOutliers.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <AnalyticsDataTable columns={columns} data={rows} searchPlaceholder={t('assessmentOutliers.searchPlaceholder')} emptyMessage={t('assessmentOutliers.emptyMessage')} />
      </CardContent>
    </Card>
  );
}
