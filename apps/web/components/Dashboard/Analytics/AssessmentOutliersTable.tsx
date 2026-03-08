'use client';

import type { AssessmentOutlierRow } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';

interface AssessmentOutliersTableProps {
  orgslug: string;
  rows: AssessmentOutlierRow[];
}

export default function AssessmentOutliersTable({ orgslug, rows }: AssessmentOutliersTableProps) {
  return (
    <Card className="border-slate-200 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle>Assessment outliers</CardTitle>
        <CardDescription>Ranked assignments, quizzes, exams, and code challenges needing attention.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Assessment</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Submission</TableHead>
              <TableHead>Pass</TableHead>
              <TableHead>Median</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Signals</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.assessment_type}-${row.assessment_id}`}>
                <TableCell>
                  <Link
                    href={`/orgs/${orgslug}/dash/analytics/assessments/${row.assessment_type}/${row.assessment_id}`}
                    className="font-medium text-slate-900 hover:text-emerald-700"
                  >
                    {row.title}
                  </Link>
                  <div className="text-xs uppercase tracking-wide text-slate-500">{row.assessment_type.replace('_', ' ')}</div>
                </TableCell>
                <TableCell>{row.course_name}</TableCell>
                <TableCell>{row.submission_rate === null ? 'n/a' : `${row.submission_rate}%`}</TableCell>
                <TableCell>{row.pass_rate === null ? 'n/a' : `${row.pass_rate}%`}</TableCell>
                <TableCell>{row.median_score === null ? 'n/a' : `${row.median_score}%`}</TableCell>
                <TableCell>{row.difficulty_score === null ? 'n/a' : row.difficulty_score}</TableCell>
                <TableCell className="max-w-[220px] whitespace-normal text-xs text-slate-600">
                  {row.outlier_reason_codes.length ? row.outlier_reason_codes.map((code) => <Badge key={code} variant="outline" className="mr-1 mb-1">{code}</Badge>) : 'Healthy'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
