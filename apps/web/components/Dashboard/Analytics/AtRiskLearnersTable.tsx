'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { AtRiskLearnerRow } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAnalyticsReasonCodeLabel, getAnalyticsRiskLevelLabel } from '@/lib/analytics/labels';
import AnalyticsDataTable from './AnalyticsDataTable';
import { useTranslations } from 'next-intl';

interface AtRiskLearnersTableProps {
  title?: string;
  description?: string;
  rows: AtRiskLearnerRow[];
  storageKey?: string;
}

const riskVariant = (level: AtRiskLearnerRow['risk_level']) => {
  if (level === 'high') return 'destructive';
  if (level === 'medium') return 'warning';
  return 'outline';
};

export default function AtRiskLearnersTable({
  title,
  description,
  rows,
  storageKey,
}: AtRiskLearnersTableProps) {
  const t = useTranslations('TeacherAnalytics');
  const resolvedTitle = title ?? t('atRisk.defaultTitle');
  const resolvedDescription = description ?? t('atRisk.defaultDescription');
  const columns: ColumnDef<AtRiskLearnerRow>[] = [
    {
      accessorKey: 'user_display_name',
      header: t('atRisk.colLearner'),
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-slate-900">{row.original.user_display_name}</div>
          <div className="text-xs text-slate-500">{t('atRisk.userNumber', { userId: row.original.user_id })}</div>
        </div>
      ),
    },
    { accessorKey: 'course_name', header: t('atRisk.colCourse') },
    {
      accessorKey: 'progress_pct',
      header: t('atRisk.colProgress'),
      cell: ({ row }) => `${row.original.progress_pct}%`,
    },
    {
      accessorKey: 'days_since_last_activity',
      header: t('atRisk.colInactivity'),
      cell: ({ row }) => (row.original.days_since_last_activity === null ? t('atRisk.na') : `${row.original.days_since_last_activity}d`),
    },
    {
      accessorKey: 'risk_score',
      header: t('atRisk.colRisk'),
      cell: ({ row }) => (
        <div className="space-y-1">
          <Badge variant={riskVariant(row.original.risk_level)}>{getAnalyticsRiskLevelLabel(t, row.original.risk_level)} · {row.original.risk_score}</Badge>
          <div className="max-w-[260px] text-[11px] leading-4 text-slate-500">
            I {Math.round(row.original.risk_components.inactivity ?? 0)} · P {Math.round(row.original.risk_components.progress ?? 0)} · F {Math.round(row.original.risk_components.failures ?? 0)} · M {Math.round(row.original.risk_components.missing ?? 0)} · G {Math.round(row.original.risk_components.grading ?? 0)}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'reason_codes',
      header: t('atRisk.colReasons'),
      cell: ({ row }) => <div className="max-w-[220px] whitespace-normal text-xs text-slate-600">{row.original.reason_codes.map((code) => getAnalyticsReasonCodeLabel(t, code)).join(', ')}</div>,
    },
    {
      accessorKey: 'recommended_action',
      header: t('atRisk.colAction'),
      cell: ({ row }) => <div className="max-w-[280px] whitespace-normal text-sm text-slate-700">{row.original.recommended_action}</div>,
    },
  ];

  return (
    <Card className="border-slate-200 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle>{resolvedTitle}</CardTitle>
        <CardDescription>{resolvedDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <AnalyticsDataTable columns={columns} data={rows} storageKey={storageKey} searchPlaceholder={t('atRisk.searchPlaceholder')} emptyMessage={t('atRisk.emptyMessage')} />
      </CardContent>
    </Card>
  );
}
