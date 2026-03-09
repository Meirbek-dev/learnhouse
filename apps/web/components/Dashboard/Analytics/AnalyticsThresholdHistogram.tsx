'use client';

import type { HistogramBucket } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartEmptyState, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts';

interface AnalyticsThresholdHistogramProps {
  title: string;
  description: string;
  data: HistogramBucket[];
  thresholdLabel?: string;
  /** Label value of the bucket at the passing threshold, used to draw a vertical reference line */
  thresholdBucketLabel?: string;
}

export default function AnalyticsThresholdHistogram({ title, description, data, thresholdLabel, thresholdBucketLabel }: AnalyticsThresholdHistogramProps) {
  const t = useTranslations('TeacherAnalytics');
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
          <ChartContainer className="h-[280px] w-full" config={{ count: { label: t('histogram.learners'), color: 'var(--chart-3)' } }}>
            <BarChart data={data}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent nameKey="label" formatter={(v) => [`${v} ${t('histogram.learners')}`, '']} />} />
              <Bar dataKey="count" radius={10} fill="var(--color-count)" />
              {thresholdBucketLabel ? (
                <ReferenceLine
                  x={thresholdBucketLabel}
                  stroke="#dc2626"
                  strokeDasharray="4 2"
                  label={{ value: t('histogram.passLabel'), position: 'insideTopRight', fontSize: 11, fill: '#dc2626' }}
                />
              ) : null}
            </BarChart>
          </ChartContainer>
        ) : (
          <ChartEmptyState description={t('histogram.emptyState')} />
        )}
      </CardContent>
    </Card>
  );
}
