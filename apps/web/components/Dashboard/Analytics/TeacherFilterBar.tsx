'use client';

import type { AnalyticsFilterOption, AnalyticsQuery } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { getAnalyticsBucketLabel, getAnalyticsCompareLabel } from '@/lib/analytics/labels';
import Link from 'next/link';
import { Filter, Globe2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

// Common IANA timezone identifiers for the select. These cover almost all deployed users.
const COMMON_TIMEZONES = [
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Almaty',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
] as const;

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

export default function TeacherFilterBar({ orgslug, path, query, courseCount, courseOptions = [], cohortOptions = [] }: TeacherFilterBarProps) {
  const t = useTranslations('TeacherAnalytics');
  const basePath = path || `/orgs/${orgslug}/dash/analytics`;

  const sortOptions = [
    { value: '', label: t('filters.sortDefault') },
    { value: 'risk', label: t('filters.sortRisk') },
    { value: 'health', label: t('filters.sortHealth') },
    { value: 'completion', label: t('filters.sortCompletion') },
    { value: 'active', label: t('filters.sortActiveLearners') },
    { value: 'difficulty', label: t('filters.sortDifficulty') },
    { value: 'signals', label: t('filters.sortSignals') },
  ];

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
          {t('filters.label')}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <Badge variant="outline">{t('filters.scopedCourses', { count: courseCount })}</Badge>
          <Badge variant="outline">{t('filters.buckets', { bucket: getAnalyticsBucketLabel(t, query.bucket || 'day') })}</Badge>
          <Badge variant="outline">{getAnalyticsCompareLabel(t, query.compare || 'previous_period')}</Badge>
          <Badge variant="outline">
            <Globe2 className="mr-1 h-3.5 w-3.5" />
            {query.timezone || 'UTC'}
          </Badge>
        </div>
        <form action={basePath} method="get" className="mt-4 grid gap-3 lg:grid-cols-6">
          <NativeSelect name="window" defaultValue={query.window || '28d'} className="w-full">
            {windows.map((windowValue) => (
              <NativeSelectOption key={windowValue} value={windowValue}>
                {t('filters.windowPrefix', { window: windowValue })}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <NativeSelect name="compare" defaultValue={query.compare || 'previous_period'} className="w-full">
            {compareOptions.map((compareValue) => (
              <NativeSelectOption key={compareValue} value={compareValue}>
                {t('filters.comparePrefix', { compare: getAnalyticsCompareLabel(t, compareValue) })}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <NativeSelect name="bucket" defaultValue={query.bucket || 'day'} className="w-full">
            {bucketOptions.map((bucketValue) => (
              <NativeSelectOption key={bucketValue} value={bucketValue}>
                {t('filters.bucketPrefix', { bucket: getAnalyticsBucketLabel(t, bucketValue) })}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <NativeSelect name="course_ids" defaultValue={query.course_ids || ''} className="w-full">
            <NativeSelectOption value="">{t('filters.allCourses')}</NativeSelectOption>
            {courseOptions.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <NativeSelect name="cohort_ids" defaultValue={query.cohort_ids || ''} className="w-full">
            <NativeSelectOption value="">{t('filters.allCohorts')}</NativeSelectOption>
            {cohortOptions.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <NativeSelect name="timezone" defaultValue={query.timezone || 'UTC'} className="w-full">
            {COMMON_TIMEZONES.map((tz) => (
              <NativeSelectOption key={tz} value={tz}>
                {tz}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <NativeSelect name="sort_by" defaultValue={query.sort_by || ''} className="w-full lg:col-span-2">
            {sortOptions.map((option) => (
              <NativeSelectOption key={option.value || 'default'} value={option.value}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <NativeSelect name="sort_order" defaultValue={query.sort_order || 'desc'} className="w-full">
            <NativeSelectOption value="desc">{t('filters.descending')}</NativeSelectOption>
            <NativeSelectOption value="asc">{t('filters.ascending')}</NativeSelectOption>
          </NativeSelect>

          <div className="flex gap-2 lg:col-span-3 lg:justify-end">
            <Button type="submit" variant="default">{t('filters.applyFilters')}</Button>
            <Button variant="outline" render={<Link href={basePath} />}>{t('filters.reset')}</Button>
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
