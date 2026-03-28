'use client';

import { BookOpenCheck, ChevronLeft, ChevronRight, Clock4, Download, Search } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

import { usePlatformSession } from '@/components/Contexts/SessionContext';
import type { Submission, SubmissionStatus } from '@/types/grading';
import { useSubmissionStats } from '@/hooks/useSubmissionStats';
import { exportGradesCSV } from '@services/grading/grading';
import SubmissionStatusBadge from './SubmissionStatusBadge';
import { useSubmissions } from '@/hooks/useSubmissions';
import { needsTeacherAction } from '@/types/grading';
import GradingStats from './GradingStats';
import GradingPanel from './GradingPanel';

interface SubmissionsTableProps {
  activityId: number;
  title?: string;
}

type StatusFilter = SubmissionStatus | 'ALL' | 'NEEDS_GRADING';

export default function SubmissionsTable({ activityId, title }: SubmissionsTableProps) {
  const t = useTranslations('Grading.Table');
  const session = usePlatformSession();
  const accessToken = session?.data?.tokens?.access_token ?? '';

  const [activeFilter, setActiveFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('submitted_at');
  const [openSubmissionUuid, setOpenSubmissionUuid] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const FILTER_OPTIONS: { labelKey: string; value: StatusFilter }[] = [
    { labelKey: 'filterAll', value: 'ALL' },
    { labelKey: 'filterNeedsGrading', value: 'NEEDS_GRADING' },
    { labelKey: 'filterGraded', value: 'GRADED' },
    { labelKey: 'filterPublished', value: 'PUBLISHED' },
    { labelKey: 'filterLate', value: 'LATE' },
    { labelKey: 'filterReturned', value: 'RETURNED' },
  ];

  // Map UI filter to API status param
  // NEEDS_GRADING is handled server-side as a virtual filter
  const statusParam: string | undefined = activeFilter === 'ALL' ? undefined : activeFilter;

  const { submissions, total, pages, page, setPage, isLoading, mutate } = useSubmissions({
    activityId,
    status: statusParam as SubmissionStatus | undefined,
    search: search || undefined,
    sortBy,
  });

  const { stats } = useSubmissionStats(activityId);
  const needsGradingCount = activeFilter === 'NEEDS_GRADING' ? total : (stats?.needs_grading_count ?? 0);

  const allUuids = submissions.map((s) => s.submission_uuid);

  const handleGradeSaved = useCallback(
    (updated: Submission) => {
      mutate();
      // Auto-advance to next submission needing action
      const currentIndex = allUuids.indexOf(updated.submission_uuid);
      const nextIndex = allUuids.findIndex(
        (uuid, i) =>
          i > currentIndex &&
          needsTeacherAction(submissions.find((s) => s.submission_uuid === uuid)?.status ?? 'GRADED'),
      );
      if (nextIndex !== -1) {
        setOpenSubmissionUuid(allUuids[nextIndex] ?? null);
      } else {
        setOpenSubmissionUuid(null);
      }
    },
    [allUuids, submissions, mutate],
  );

  const handleExportCSV = useCallback(async () => {
    if (!accessToken) return;
    setIsExporting(true);
    try {
      const csv = await exportGradesCSV(activityId, accessToken);
      if (!csv) return;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `grades-activity-${activityId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, [activityId, accessToken]);

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <GradingStats activityId={activityId} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {needsGradingCount > 0 && (
            <div className="mt-1 flex items-center gap-1.5 text-amber-700">
              <Clock4 className="h-4 w-4" />
              <span className="text-sm font-medium">
                {needsGradingCount} {t('needGrading')}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs"
          >
            {t('total', { count: total })}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={isExporting || total === 0}
          >
            <Download className="h-4 w-4 mr-1.5" />
            {t('exportCSV')}
          </Button>
        </div>
      </div>

      {/* Search + sort toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={sortBy}
          onValueChange={(v) => {
            if (v) setSortBy(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t('sortBy')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="submitted_at">{t('sortByDate')}</SelectItem>
            <SelectItem value="final_score">{t('sortByScore')}</SelectItem>
            <SelectItem value="attempt_number">{t('sortByAttempt')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Filter tabs */}
      <Tabs
        value={activeFilter}
        onValueChange={(v) => {
          setActiveFilter(v as StatusFilter);
          setPage(1);
        }}
      >
        <TabsList className="flex-wrap h-auto gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <TabsTrigger
              key={opt.value}
              value={opt.value}
            >
              {t(opt.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Table */}
      {isLoading ? (
        <PageLoading />
      ) : submissions.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-slate-500">
          {t('empty')}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('student')}</TableHead>
                <TableHead>{t('attempt')}</TableHead>
                <TableHead>{t('submitted')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead className="text-right">{t('score')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((sub) => (
                <SubmissionRow
                  key={sub.submission_uuid}
                  submission={sub}
                  onGrade={() => setOpenSubmissionUuid(sub.submission_uuid)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prev')}
          </Button>
          <span className="text-sm text-slate-600">{t('pageOf', { page, pages })}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Side panel */}
      <GradingPanel
        submissionUuid={openSubmissionUuid}
        allSubmissionUuids={allUuids}
        onClose={() => setOpenSubmissionUuid(null)}
        onGradeSaved={handleGradeSaved}
        onNavigate={(uuid) => setOpenSubmissionUuid(uuid)}
      />
    </div>
  );
}

// ── Row component ─────────────────────────────────────────────────────────────

function SubmissionRow({ submission, onGrade }: { submission: Submission; onGrade: () => void }) {
  const t = useTranslations('Grading.Table');

  const displayName = submission.user
    ? [submission.user.first_name, submission.user.middle_name, submission.user.last_name].filter(Boolean).join(' ') ||
      `@${submission.user.username}`
    : `User #${submission.user_id}`;

  const actionNeeded = needsTeacherAction(submission.status);

  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="font-medium text-sm">{displayName}</p>
          {submission.user?.email && <p className="text-xs text-slate-400">{submission.user.email}</p>}
        </div>
      </TableCell>
      <TableCell className="text-center text-sm text-slate-600">#{submission.attempt_number}</TableCell>
      <TableCell className="text-sm text-slate-600">
        {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : '—'}
      </TableCell>
      <TableCell>
        <SubmissionStatusBadge status={submission.status} />
      </TableCell>
      <TableCell className="text-right font-semibold">
        {submission.final_score !== null ? (
          <span>{submission.final_score}/100</span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          variant={actionNeeded ? 'default' : 'outline'}
          onClick={onGrade}
          className="gap-1.5"
        >
          <BookOpenCheck className="h-3.5 w-3.5" />
          {actionNeeded ? t('grade') : t('view')}
        </Button>
      </TableCell>
    </TableRow>
  );
}
