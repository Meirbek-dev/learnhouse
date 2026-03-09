'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { AssessmentOutlierRow } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AnalyticsDataTable from './AnalyticsDataTable';
import Link from 'next/link';

interface AssessmentOutliersTableProps {
  orgslug: string;
  rows: AssessmentOutlierRow[];
}

export default function AssessmentOutliersTable({ orgslug, rows }: AssessmentOutliersTableProps) {
  const columns: ColumnDef<AssessmentOutlierRow>[] = [
    {
      accessorKey: 'title',
      header: 'Assessment',
      cell: ({ row }) => (
        <div>
          <Link
            href={`/orgs/${orgslug}/dash/analytics/assessments/${row.original.assessment_type}/${row.original.assessment_id}`}
            className="font-medium text-slate-900 hover:text-emerald-700"
          >
            {row.original.title}
          </Link>
          <div className="text-xs uppercase tracking-wide text-slate-500">{row.original.assessment_type.replace('_', ' ')}</div>
        </div>
      ),
    },
    { accessorKey: 'course_name', header: 'Course' },
    {
      accessorKey: 'submission_rate',
      header: 'Submission',
      cell: ({ row }) => (row.original.submission_rate === null ? 'n/a' : `${row.original.submission_rate}%`),
    },
    {
      accessorKey: 'pass_rate',
      header: 'Pass',
      cell: ({ row }) => (row.original.pass_rate === null ? 'n/a' : `${row.original.pass_rate}%`),
    },
    {
      accessorKey: 'median_score',
      header: 'Median',
      cell: ({ row }) => (row.original.median_score === null ? 'n/a' : `${row.original.median_score}%`),
    },
    {
      accessorKey: 'difficulty_score',
      header: 'Difficulty',
      cell: ({ row }) => (row.original.difficulty_score === null ? 'n/a' : row.original.difficulty_score),
    },
    {
      accessorKey: 'outlier_reason_codes',
      header: 'Signals',
      cell: ({ row }) =>
        row.original.outlier_reason_codes.length ? (
          <div className="max-w-[240px] whitespace-normal text-xs text-slate-600">
            {row.original.outlier_reason_codes.map((code) => (
              <Badge key={code} variant="outline" className="mb-1 mr-1">
                {code}
              </Badge>
            ))}
          </div>
        ) : (
          'Healthy'
        ),
    },
  ];

  return (
    <Card className="border-slate-200 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle>Assessment outliers</CardTitle>
        <CardDescription>Ranked assignments, quizzes, exams, and code challenges needing attention.</CardDescription>
      </CardHeader>
      <CardContent>
        <AnalyticsDataTable columns={columns} data={rows} searchPlaceholder="Search assessments..." emptyMessage="No assessment outliers match the current scope." />
      </CardContent>
    </Card>
  );
}
