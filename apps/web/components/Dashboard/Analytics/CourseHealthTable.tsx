'use client';

import type { TeacherCourseRow } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';

interface CourseHealthTableProps {
  orgslug: string;
  rows: TeacherCourseRow[];
}

export default function CourseHealthTable({ orgslug, rows }: CourseHealthTableProps) {
  return (
    <Card className="border-slate-200 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle>Course health ranking</CardTitle>
        <CardDescription>Courses ranked by operational pressure, engagement, and content quality.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course</TableHead>
              <TableHead>Active 7d</TableHead>
              <TableHead>Completion</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead>Ungraded</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Top alert</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.course_id}>
                <TableCell>
                  <Link href={`/orgs/${orgslug}/dash/analytics/courses/${row.course_uuid}`} className="font-medium text-slate-900 hover:text-emerald-700">
                    {row.course_name}
                  </Link>
                </TableCell>
                <TableCell>{row.active_learners_7d}</TableCell>
                <TableCell>{row.completion_rate}%</TableCell>
                <TableCell>{row.at_risk_learners}</TableCell>
                <TableCell>{row.ungraded_submissions}</TableCell>
                <TableCell>{row.content_health_score}</TableCell>
                <TableCell>
                  {row.top_alert ? <Badge variant={row.top_alert.severity === 'critical' ? 'destructive' : row.top_alert.severity === 'warning' ? 'warning' : 'outline'}>{row.top_alert.title}</Badge> : 'No alert'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
