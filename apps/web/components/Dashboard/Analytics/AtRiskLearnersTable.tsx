'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { AtRiskLearnerRow } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AnalyticsDataTable from './AnalyticsDataTable';

interface AtRiskLearnersTableProps {
  title?: string;
  description?: string;
  rows: AtRiskLearnerRow[];
}

const riskVariant = (level: AtRiskLearnerRow['risk_level']) => {
  if (level === 'high') return 'destructive';
  if (level === 'medium') return 'warning';
  return 'outline';
};

export default function AtRiskLearnersTable({
  title = 'At-risk learners',
  description = 'Operational learner list ranked by urgency.',
  rows,
}: AtRiskLearnersTableProps) {
  const columns: ColumnDef<AtRiskLearnerRow>[] = [
    {
      accessorKey: 'user_display_name',
      header: 'Learner',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-slate-900">{row.original.user_display_name}</div>
          <div className="text-xs text-slate-500">User #{row.original.user_id}</div>
        </div>
      ),
    },
    { accessorKey: 'course_name', header: 'Course' },
    {
      accessorKey: 'progress_pct',
      header: 'Progress',
      cell: ({ row }) => `${row.original.progress_pct}%`,
    },
    {
      accessorKey: 'days_since_last_activity',
      header: 'Inactivity',
      cell: ({ row }) => (row.original.days_since_last_activity === null ? 'n/a' : `${row.original.days_since_last_activity}d`),
    },
    {
      accessorKey: 'risk_score',
      header: 'Risk',
      cell: ({ row }) => <Badge variant={riskVariant(row.original.risk_level)}>{row.original.risk_level} · {row.original.risk_score}</Badge>,
    },
    {
      accessorKey: 'reason_codes',
      header: 'Reasons',
      cell: ({ row }) => <div className="max-w-[220px] whitespace-normal text-xs text-slate-600">{row.original.reason_codes.join(', ')}</div>,
    },
    {
      accessorKey: 'recommended_action',
      header: 'Recommended action',
      cell: ({ row }) => <div className="max-w-[280px] whitespace-normal text-sm text-slate-700">{row.original.recommended_action}</div>,
    },
  ];

  return (
    <Card className="border-slate-200 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <AnalyticsDataTable columns={columns} data={rows} searchPlaceholder="Search learners, courses, or reason codes..." emptyMessage="No at-risk learners are visible for the current filters." />
      </CardContent>
    </Card>
  );
}
