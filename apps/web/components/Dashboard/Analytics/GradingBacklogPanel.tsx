'use client';

import type { AlertItem } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock4 } from 'lucide-react';

interface GradingBacklogPanelProps {
  backlogCount: number;
  alerts: AlertItem[];
}

export default function GradingBacklogPanel({ backlogCount, alerts }: GradingBacklogPanelProps) {
  const gradingAlerts = alerts.filter((alert) => alert.type === 'grading_backlog');
  return (
    <Card className="border-amber-200 bg-linear-to-br from-amber-50 via-white to-white shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2 text-amber-700">
          <Clock4 className="h-5 w-5" />
          <CardTitle>Grading backlog</CardTitle>
        </div>
        <CardDescription>Outstanding submissions that are slowing learner feedback loops.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-semibold text-slate-900">{backlogCount}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          {gradingAlerts.length ? gradingAlerts.map((alert) => <Badge key={alert.id} variant={alert.severity === 'critical' ? 'destructive' : 'warning'}>{alert.title}</Badge>) : <Badge variant="outline">No grading alert</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}
