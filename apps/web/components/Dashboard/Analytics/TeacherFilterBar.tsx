'use client';

import type { AnalyticsQuery } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Filter, Globe2 } from 'lucide-react';

interface TeacherFilterBarProps {
  orgslug: string;
  query: AnalyticsQuery;
  courseCount: number;
}

const windows: Array<NonNullable<AnalyticsQuery['window']>> = ['7d', '28d', '90d'];

export default function TeacherFilterBar({ orgslug, query, courseCount }: TeacherFilterBarProps) {
  const buildHref = (windowValue: string) => {
    const params = new URLSearchParams();
    params.set('window', windowValue);
    params.set('compare', query.compare || 'previous_period');
    params.set('bucket', query.bucket || 'day');
    if (query.course_ids) params.set('course_ids', query.course_ids);
    if (query.cohort_ids) params.set('cohort_ids', query.cohort_ids);
    if (query.timezone) params.set('timezone', query.timezone);
    return `/orgs/${orgslug}/dash/analytics?${params.toString()}`;
  };

  return (
    <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white/85 p-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          <Filter className="h-3.5 w-3.5" />
          Teacher Analytics
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <Badge variant="outline">{courseCount} scoped courses</Badge>
          <Badge variant="outline">{query.bucket || 'day'} buckets</Badge>
          <Badge variant="outline">{query.compare || 'previous_period'}</Badge>
          <Badge variant="outline">
            <Globe2 className="mr-1 h-3.5 w-3.5" />
            {query.timezone || 'UTC'}
          </Badge>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {windows.map((windowValue) => (
          <Button
            key={windowValue}
            variant={query.window === windowValue ? 'default' : 'outline'}
            size="sm"
            render={<Link href={buildHref(windowValue)} />}
          >
            {windowValue}
          </Button>
        ))}
      </div>
    </div>
  );
}
