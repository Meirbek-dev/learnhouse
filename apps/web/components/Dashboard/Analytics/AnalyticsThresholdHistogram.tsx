'use client';

import type { HistogramBucket } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartEmptyState, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

interface AnalyticsThresholdHistogramProps {
  title: string;
  description: string;
  data: HistogramBucket[];
  thresholdLabel?: string;
}

export default function AnalyticsThresholdHistogram({ title, description, data, thresholdLabel }: AnalyticsThresholdHistogramProps) {
  return (
    <Card className="border-slate-200 bg-white/90 shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {thresholdLabel ? <Badge variant="outline">{thresholdLabel}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent>
        {data.length ? (
          <ChartContainer className="h-[280px] w-full" config={{ count: { label: 'Learners', color: '#1d4ed8' } }}>
            <BarChart data={data}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" radius={10} fill="var(--color-count)" />
            </BarChart>
          </ChartContainer>
        ) : (
          <ChartEmptyState description="Histogram data is not available for the selected assessment." />
        )}
      </CardContent>
    </Card>
  );
}
