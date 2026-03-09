'use client';

import type { QuestionDifficultyRow } from '@/types/analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts';

interface QuestionDifficultyRadarProps {
  title: string;
  description: string;
  data: QuestionDifficultyRow[];
}

export default function QuestionDifficultyRadar({ title, description, data }: QuestionDifficultyRadarProps) {
  const MAX = 8;
  const radarData = data.slice(0, MAX).map((row) => ({
    label: row.question_label,
    accuracy: row.accuracy_pct ?? 0,
  }));

  return (
    <Card className="border-slate-200 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length > MAX && (
          <p className="mb-2 text-xs text-slate-500">Showing {MAX} of {data.length} questions by difficulty.</p>
        )}
        <ChartContainer className="h-[320px] w-full" config={{ accuracy: { label: 'Accuracy', color: '#0f766e' } }}>
          <RadarChart data={radarData}>
            <ChartTooltip content={<ChartTooltipContent />} />
            <PolarGrid />
            <PolarAngleAxis dataKey="label" tick={{ fontSize: 11 }} />
            <Radar dataKey="accuracy" fill="var(--color-accuracy)" fillOpacity={0.25} stroke="var(--color-accuracy)" strokeWidth={2} />
          </RadarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
