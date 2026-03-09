'use client';

import type { AtRiskLearnerRow } from '@/types/analytics';
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartEmptyState, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

interface AnalyticsRiskDistributionChartProps {
  rows: AtRiskLearnerRow[];
  totalAtRisk?: number;
}

const RISK_COLORS: Record<string, string> = {
  High: '#dc2626',
  Medium: '#f59e0b',
  Low: '#64748b',
};

export default function AnalyticsRiskDistributionChart({ rows, totalAtRisk }: AnalyticsRiskDistributionChartProps) {
  const data = [
    { level: 'High', count: rows.filter((row) => row.risk_level === 'high').length },
    { level: 'Medium', count: rows.filter((row) => row.risk_level === 'medium').length },
    { level: 'Low', count: rows.filter((row) => row.risk_level === 'low').length },
  ].filter((item) => item.count > 0);

  const isPreview = totalAtRisk !== undefined && totalAtRisk > rows.length;

  return (
    <Card className="border-slate-200 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle>Risk distribution</CardTitle>
        <CardDescription>
          Learner risk by urgency level for the current scope.
          {isPreview ? ` Showing top ${rows.length} of ${totalAtRisk} at-risk learners.` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length ? (
          <ChartContainer className="h-[280px] w-full" config={{ count: { label: 'Learners' } }}>
            <BarChart data={data}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="level" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" radius={10}>
                {data.map((entry) => (
                  <Cell key={entry.level} fill={RISK_COLORS[entry.level] ?? '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <ChartEmptyState description="No at-risk learners are currently in view for the selected scope." />
        )}
      </CardContent>
    </Card>
  );
}
