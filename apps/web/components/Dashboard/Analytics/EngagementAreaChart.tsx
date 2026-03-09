'use client';

import type { TimeSeriesPoint } from '@/types/analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useLocale } from 'next-intl';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

interface EngagementAreaChartProps {
  title: string;
  description: string;
  data: TimeSeriesPoint[];
}

export default function EngagementAreaChart({ title, description, data }: EngagementAreaChartProps) {
  const locale = useLocale();
  const chartData = data.map((point) => ({
    bucket: new Date(point.bucket_start).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
    value: point.value,
  }));

  return (
    <Card className="border-slate-200 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          className="h-[280px] w-full"
          config={{
            value: { label: title, color: '#0f766e' },
          }}
        >
          <AreaChart data={chartData}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area dataKey="value" type="monotone" fill="var(--color-value)" stroke="var(--color-value)" fillOpacity={0.18} strokeWidth={2.5} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
