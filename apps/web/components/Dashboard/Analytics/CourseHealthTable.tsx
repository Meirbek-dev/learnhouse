'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { TeacherCourseRow } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AnalyticsDataTable from './AnalyticsDataTable';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface CourseHealthTableProps {
  orgslug: string;
  rows: TeacherCourseRow[];
}

export default function CourseHealthTable({ orgslug, rows }: CourseHealthTableProps) {
  const t = useTranslations('TeacherAnalytics');
  const columns: ColumnDef<TeacherCourseRow>[] = [
    {
      accessorKey: 'course_name',
      header: t('courseHealth.colCourse'),
      cell: ({ row }) => (
        <Link href={`/orgs/${orgslug}/dash/analytics/courses/${row.original.course_uuid}`} className="font-medium text-slate-900 hover:text-emerald-700">
          {row.original.course_name}
        </Link>
      ),
    },
    { accessorKey: 'active_learners_7d', header: t('courseHealth.colActive7d') },
    {
      accessorKey: 'completion_rate',
      header: t('courseHealth.colCompletion'),
      cell: ({ row }) => `${row.original.completion_rate}%`,
    },
    { accessorKey: 'at_risk_learners', header: t('courseHealth.colRisk') },
    { accessorKey: 'ungraded_submissions', header: t('courseHealth.colUngraded') },
    {
      accessorKey: 'content_health_score',
      header: t('courseHealth.colHealth'),
      cell: ({ row }) => {
        const v = row.original.content_health_score;
        if (v == null) return t('atRisk.na');
        // Score is on a 0–1 scale; render as a percentage for human readability.
        return `${Math.round(v * 100)}%`;
      },
    },
    {
      accessorKey: 'top_alert',
      header: t('courseHealth.colTopAlert'),
      cell: ({ row }) =>
        row.original.top_alert ? (
          <Badge variant={row.original.top_alert.severity === 'critical' ? 'destructive' : row.original.top_alert.severity === 'warning' ? 'warning' : 'outline'}>
            {row.original.top_alert.title}
          </Badge>
        ) : (
          t('courseHealth.noAlert')
        ),
    },
  ];

  return (
    <Card className="border-slate-200 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle>{t('courseHealth.title')}</CardTitle>
        <CardDescription>{t('courseHealth.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <AnalyticsDataTable columns={columns} data={rows} searchPlaceholder={t('courseHealth.searchPlaceholder')} emptyMessage={t('courseHealth.emptyMessage')} />
      </CardContent>
    </Card>
  );
}
