'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { TeacherCourseRow } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AnalyticsDataTable from './AnalyticsDataTable';
import Link from 'next/link';

interface CourseHealthTableProps {
  orgslug: string;
  rows: TeacherCourseRow[];
}

export default function CourseHealthTable({ orgslug, rows }: CourseHealthTableProps) {
  const columns: ColumnDef<TeacherCourseRow>[] = [
    {
      accessorKey: 'course_name',
      header: 'Course',
      cell: ({ row }) => (
        <Link href={`/orgs/${orgslug}/dash/analytics/courses/${row.original.course_uuid}`} className="font-medium text-slate-900 hover:text-emerald-700">
          {row.original.course_name}
        </Link>
      ),
    },
    { accessorKey: 'active_learners_7d', header: 'Active 7d' },
    {
      accessorKey: 'completion_rate',
      header: 'Completion',
      cell: ({ row }) => `${row.original.completion_rate}%`,
    },
    { accessorKey: 'at_risk_learners', header: 'Risk' },
    { accessorKey: 'ungraded_submissions', header: 'Ungraded' },
    { accessorKey: 'content_health_score', header: 'Health' },
    {
      accessorKey: 'top_alert',
      header: 'Top alert',
      cell: ({ row }) =>
        row.original.top_alert ? (
          <Badge variant={row.original.top_alert.severity === 'critical' ? 'destructive' : row.original.top_alert.severity === 'warning' ? 'warning' : 'outline'}>
            {row.original.top_alert.title}
          </Badge>
        ) : (
          'No alert'
        ),
    },
  ];

  return (
    <Card className="border-slate-200 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle>Course health ranking</CardTitle>
        <CardDescription>Courses ranked by operational pressure, engagement, and content quality.</CardDescription>
      </CardHeader>
      <CardContent>
        <AnalyticsDataTable columns={columns} data={rows} searchPlaceholder="Search courses..." emptyMessage="No courses match the current analytics scope." />
      </CardContent>
    </Card>
  );
}
