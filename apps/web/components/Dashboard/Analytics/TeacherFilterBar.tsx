'use client';

import type { AnalyticsFilterOption, AnalyticsQuery } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import Link from 'next/link';
import { Filter, Globe2 } from 'lucide-react';

interface TeacherFilterBarProps {
  orgslug: string;
  path?: string;
  query: AnalyticsQuery;
  courseCount: number;
  courseOptions?: AnalyticsFilterOption[];
  cohortOptions?: AnalyticsFilterOption[];
}

const windows: Array<NonNullable<AnalyticsQuery['window']>> = ['7d', '28d', '90d'];

const compareOptions: Array<NonNullable<AnalyticsQuery['compare']>> = ['previous_period', 'none'];
const bucketOptions: Array<NonNullable<AnalyticsQuery['bucket']>> = ['day', 'week'];
const sortOptions = [
  { value: '', label: 'Default ranking' },
  { value: 'risk', label: 'Risk' },
  { value: 'health', label: 'Health' },
  { value: 'completion', label: 'Completion' },
  { value: 'active', label: 'Active learners' },
  { value: 'difficulty', label: 'Difficulty' },
  { value: 'signals', label: 'Signals' },
];

export default function TeacherFilterBar({ orgslug, path, query, courseCount, courseOptions = [], cohortOptions = [] }: TeacherFilterBarProps) {
  const basePath = path || `/orgs/${orgslug}/dash/analytics`;

  const buildHref = (windowValue: string) => {
    const params = new URLSearchParams();
    params.set('window', windowValue);
    params.set('compare', query.compare || 'previous_period');
    params.set('bucket', query.bucket || 'day');
    if (query.course_ids) params.set('course_ids', query.course_ids);
    if (query.cohort_ids) params.set('cohort_ids', query.cohort_ids);
    if (query.sort_by) params.set('sort_by', query.sort_by);
    if (query.sort_order) params.set('sort_order', query.sort_order);
    if (query.timezone) params.set('timezone', query.timezone);
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white/85 p-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
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
        <form action={basePath} method="get" className="mt-4 grid gap-3 lg:grid-cols-6">
          <NativeSelect name="window" defaultValue={query.window || '28d'} className="w-full">
            {windows.map((windowValue) => (
              <NativeSelectOption key={windowValue} value={windowValue}>
                Window: {windowValue}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <NativeSelect name="compare" defaultValue={query.compare || 'previous_period'} className="w-full">
            {compareOptions.map((compareValue) => (
              <NativeSelectOption key={compareValue} value={compareValue}>
                Compare: {compareValue.replace('_', ' ')}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <NativeSelect name="bucket" defaultValue={query.bucket || 'day'} className="w-full">
            {bucketOptions.map((bucketValue) => (
              <NativeSelectOption key={bucketValue} value={bucketValue}>
                Bucket: {bucketValue}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <NativeSelect name="course_ids" defaultValue={query.course_ids || ''} className="w-full">
            <NativeSelectOption value="">All courses</NativeSelectOption>
            {courseOptions.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <NativeSelect name="cohort_ids" defaultValue={query.cohort_ids || ''} className="w-full">
            <NativeSelectOption value="">All cohorts</NativeSelectOption>
            {cohortOptions.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <Input name="timezone" defaultValue={query.timezone || 'UTC'} placeholder="Timezone" />

          <NativeSelect name="sort_by" defaultValue={query.sort_by || ''} className="w-full lg:col-span-2">
            {sortOptions.map((option) => (
              <NativeSelectOption key={option.value || 'default'} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <NativeSelect name="sort_order" defaultValue={query.sort_order || 'desc'} className="w-full">
            <NativeSelectOption value="desc">Descending</NativeSelectOption>
            <NativeSelectOption value="asc">Ascending</NativeSelectOption>
          </NativeSelect>

          <div className="flex gap-2 lg:col-span-3 lg:justify-end">
            <Button type="submit" variant="default">Apply filters</Button>
            <Button variant="outline" render={<Link href={basePath} />}>Reset</Button>
          </div>
        </form>
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
