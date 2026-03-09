'use client';

import type { MetricCard } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface TeacherKpiCardsProps {
  metrics: MetricCard[];
}

const iconForDirection = (direction: MetricCard['direction']) => {
  if (direction === 'up') return <ArrowUpRight className="h-4 w-4" />;
  if (direction === 'down') return <ArrowDownRight className="h-4 w-4" />;
  return <Minus className="h-4 w-4" />;
};

const badgeVariant = (direction: MetricCard['direction']) => {
  if (direction === 'up') return 'success';
  if (direction === 'down') return 'warning';
  return 'outline';
};

export default function TeacherKpiCards({ metrics }: TeacherKpiCardsProps) {
  const t = useTranslations('TeacherAnalytics');
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {metrics.map((metric) => (
        <Card
          key={metric.label}
          className="border-slate-200 bg-white/90 shadow-sm"
        >
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{metric.label}</div>
              <CardTitle className="mt-3 text-3xl font-semibold text-slate-900">{metric.value.toLocaleString()}</CardTitle>
            </div>
            <Badge variant={badgeVariant(metric.direction)}>
              {iconForDirection(metric.direction)}
              {metric.delta_pct === null ? t('kpi.stable') : `${metric.delta_pct > 0 ? '+' : ''}${metric.delta_pct}%`}
            </Badge>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            {metric.delta_value === null ? t('kpi.noComparison') : t('kpi.changePeriod', { delta: `${metric.delta_value > 0 ? '+' : ''}${metric.delta_value}` })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
