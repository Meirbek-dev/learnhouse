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

/**
 * For metrics where "up is bad" (at_risk_learners, ungraded_submissions,
 * negative_engagement_courses), reverse the success/warning mapping so that
 * an increase shows as a warning badge and a decrease as a success badge.
 */
const badgeVariant = (direction: MetricCard['direction'], isHigherBetter: boolean) => {
  const isPositiveChange = direction === 'up' ? isHigherBetter : direction === 'down' ? !isHigherBetter : null;
  if (isPositiveChange === true) return 'success';
  if (isPositiveChange === false) return 'warning';
  return 'outline';
};

export default function TeacherKpiCards({ metrics }: TeacherKpiCardsProps) {
  const t = useTranslations('TeacherAnalytics');
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {metrics.map((metric) => {
        const displayValue = metric.unit === '%'
          ? `${metric.value.toLocaleString()}%`
          : metric.value.toLocaleString();

        let deltaLabel: string;
        if (metric.delta_pct === null && metric.delta_value === null) {
          deltaLabel = t('kpi.noComparison');
        } else if (metric.delta_pct === null && metric.delta_value !== null) {
          // Previous was 0 — delta_pct is undefined, show absolute change instead
          deltaLabel = `${metric.delta_value > 0 ? '+' : ''}${metric.delta_value}`;
        } else if (metric.delta_pct !== null) {
          deltaLabel = `${metric.delta_pct > 0 ? '+' : ''}${metric.delta_pct}%`;
        } else {
          deltaLabel = t('kpi.stable');
        }

        // When delta_pct is null but delta_value is non-null, the previous period had
        // no data — show "нет данных" rather than "стабильно" to avoid misleading teachers.
        const badgeLabel = metric.delta_value === null
          ? t('kpi.noComparison')
          : metric.delta_pct === null
            ? t('kpi.noData')
            : deltaLabel;

        return (
          <Card
            key={metric.label}
            className="border-slate-200 bg-white/90 shadow-sm"
          >
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{metric.label}</div>
                <CardTitle className="mt-3 text-3xl font-semibold text-slate-900">{displayValue}</CardTitle>
              </div>
              {metric.delta_value !== null && (
                <Badge variant={badgeVariant(metric.direction, metric.is_higher_better ?? true)}>
                  {iconForDirection(metric.direction)}
                  {badgeLabel}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              {metric.delta_value === null
                ? t('kpi.noComparison')
                : t('kpi.changePeriod', { delta: `${metric.delta_value > 0 ? '+' : ''}${metric.delta_value}${metric.unit ?? ''}` })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
