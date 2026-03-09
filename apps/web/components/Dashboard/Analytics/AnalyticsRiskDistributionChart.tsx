'use client';

import type { AtRiskLearnerRow } from '@/types/analytics';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartEmptyState, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

interface AnalyticsRiskDistributionChartProps {
  rows: AtRiskLearnerRow[];
}

export default function AnalyticsRiskDistributionChart({ rows }: AnalyticsRiskDistributionChartProps) {
  const data = [
    { level: 'High', count: rows.filter((row) => row.risk_level === 'high').length },
    { level: 'Medium', count: rows.filter((row) => row.risk_level === 'medium').length },
    { level: 'Low', count: rows.filter((row) => row.risk_level === 'low').length },
  ].filter((item) => item.count > 0);

  return (
    <Card className="border-slate-200 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle>Risk distribution</CardTitle>
        <CardDescription>Visible learner risk by urgency level for the current scope.</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length ? (
          <ChartContainer className="h-[280px] w-full" config={{ count: { label: 'Learners', color: '#dc2626' } }}>
            <BarChart data={data}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="level" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={10} />
            </BarChart>
          </ChartContainer>
        ) : (
          <ChartEmptyState description="No at-risk learners are currently in view for the selected scope." />
        )}
      </CardContent>
    </Card>
  );
}
