'use client';

import type { AtRiskLearnerRow } from '@/types/analytics';
import { getAnalyticsRiskLevelLabel } from '@/lib/analytics/labels';
import { useTranslations } from 'next-intl';
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartEmptyState, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

interface AnalyticsRiskDistributionChartProps {
  rows: AtRiskLearnerRow[];
  totalAtRisk?: number;
}

const RISK_COLORS: Record<string, string> = {
  high: '#dc2626',
  medium: '#f59e0b',
  low: '#64748b',
};

export default function AnalyticsRiskDistributionChart({ rows, totalAtRisk }: AnalyticsRiskDistributionChartProps) {
  const t = useTranslations('TeacherAnalytics');
  const data = [
    { level: 'high', label: getAnalyticsRiskLevelLabel(t, 'high'), count: rows.filter((row) => row.risk_level === 'high').length },
    { level: 'medium', label: getAnalyticsRiskLevelLabel(t, 'medium'), count: rows.filter((row) => row.risk_level === 'medium').length },
    { level: 'low', label: getAnalyticsRiskLevelLabel(t, 'low'), count: rows.filter((row) => row.risk_level === 'low').length },
  ].filter((item) => item.count > 0);

  const isPreview = totalAtRisk !== undefined && totalAtRisk > rows.length;

  return (
    <Card className="border-slate-200 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle>{t('riskDistribution.title')}</CardTitle>
        <CardDescription>
          {t('riskDistribution.description')}
          {isPreview ? ` ${t('riskDistribution.preview', { shown: rows.length, total: totalAtRisk })}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length ? (
          <ChartContainer className="h-[280px] w-full" config={{ count: { label: t('riskDistribution.learners') } }}>
            <BarChart data={data}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
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
          <ChartEmptyState description={t('riskDistribution.emptyState')} />
        )}
      </CardContent>
    </Card>
  );
}
