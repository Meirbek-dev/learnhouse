'use client';

import { Area, AreaChart, CartesianGrid, Legend, XAxis, YAxis } from 'recharts';
import { useTranslations } from 'next-intl';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartEmptyState, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

interface AnalyticsMultiSeriesTrendRow {
  bucket_start: string;
  bucket: string;
  active_learners: number;
  completions: number;
  submissions: number;
  grading_completed: number;
}

interface AnalyticsMultiSeriesTrendChartProps {
  title: string;
  description: string;
  data: AnalyticsMultiSeriesTrendRow[];
  onBucketClick?: (bucketStart: string) => void;
}

interface AnalyticsTrendChartClickState {
  activePayload?: Array<{
    payload?: AnalyticsMultiSeriesTrendRow;
  }>;
}

export default function AnalyticsMultiSeriesTrendChart({ title, description, data, onBucketClick }: AnalyticsMultiSeriesTrendChartProps) {
  const t = useTranslations('TeacherAnalytics');

  const handleChartClick = (state: AnalyticsTrendChartClickState | undefined) => {
    const bucketStart = state?.activePayload?.[0]?.payload?.bucket_start;
    if (bucketStart) {
      onBucketClick?.(bucketStart);
    }
  };

  return (
    <Card className="border-slate-200 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length ? (
          <ChartContainer
            className="h-[320px] w-full"
            config={{
              active_learners: { label: t('trend.activeLearners'), color: 'var(--chart-1)' },
              completions: { label: t('trend.completions'), color: 'var(--chart-2)' },
              submissions: { label: t('trend.submissions'), color: 'var(--chart-3)' },
              grading_completed: { label: t('trend.gradingCompleted'), color: 'var(--chart-4)' },
            }}
          >
            <AreaChart data={data} onClick={handleChartClick}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="bucket" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend content={<ChartLegendContent />} />
              <Area type="monotone" dataKey="active_learners" stroke="var(--color-active_learners)" fill="var(--color-active_learners)" fillOpacity={0.14} strokeWidth={2.5} />
              <Area type="monotone" dataKey="completions" stroke="var(--color-completions)" fill="var(--color-completions)" fillOpacity={0.1} strokeWidth={2} />
              <Area type="monotone" dataKey="submissions" stroke="var(--color-submissions)" fill="var(--color-submissions)" fillOpacity={0.08} strokeWidth={2} />
              <Area type="monotone" dataKey="grading_completed" stroke="var(--color-grading_completed)" fill="var(--color-grading_completed)" fillOpacity={0.06} strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
        ) : (
          <ChartEmptyState description={t('trend.emptyState')} />
        )}
      </CardContent>
    </Card>
  );
}
