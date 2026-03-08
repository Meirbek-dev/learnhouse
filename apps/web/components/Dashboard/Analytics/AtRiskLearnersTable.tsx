'use client';

import type { AtRiskLearnerRow } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
  return (
    <Card className="border-slate-200 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Learner</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Inactivity</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead>Reasons</TableHead>
              <TableHead>Recommended action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.course_id}-${row.user_id}`}>
                <TableCell>
                  <div className="font-medium text-slate-900">{row.user_display_name}</div>
                  <div className="text-xs text-slate-500">User #{row.user_id}</div>
                </TableCell>
                <TableCell>{row.course_name}</TableCell>
                <TableCell>{row.progress_pct}%</TableCell>
                <TableCell>{row.days_since_last_activity === null ? 'n/a' : `${row.days_since_last_activity}d`}</TableCell>
                <TableCell>
                  <Badge variant={riskVariant(row.risk_level)}>{row.risk_level} · {row.risk_score}</Badge>
                </TableCell>
                <TableCell className="max-w-[220px] whitespace-normal text-xs text-slate-600">{row.reason_codes.join(', ')}</TableCell>
                <TableCell className="max-w-[280px] whitespace-normal text-sm text-slate-700">{row.recommended_action}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
