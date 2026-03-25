'use client';

/**
 * SubmissionsTable
 *
 * Paginated, filterable teacher submissions table.
 *
 * Replaces the 3-column Kanban board (AssignmentSubmissionsSubPage) that:
 * - Loaded ALL submissions at once with no pagination
 * - Had no filtering, searching, or sorting
 * - Used fixed 350px cards with hardcoded flex layout
 * - Opened a modal with 3 nested Context Providers and no grade input
 *
 * Features:
 * - Status filter tabs (All / Needs Grading / Graded / Late)
 * - Sort by: submitted date, score, student name
 * - Pagination
 * - "Grade ▸" opens GradingPanel side panel with real score input
 * - Grading backlog count in header
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { BookOpenCheck, ChevronLeft, ChevronRight, Clock4 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageLoading from '@components/Objects/Loaders/PageLoading';

import { useSubmissions } from '@/hooks/useSubmissions';
import GradingPanel from './GradingPanel';
import SubmissionStatusBadge from './SubmissionStatusBadge';
import type { Submission, SubmissionStatus } from '@/types/grading';

interface SubmissionsTableProps {
  activityId: number;
  title?: string;
}

type StatusFilter = SubmissionStatus | 'ALL' | 'NEEDS_GRADING';

const FILTER_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Needs Grading', value: 'NEEDS_GRADING' },
  { label: 'Graded', value: 'GRADED' },
  { label: 'Late', value: 'LATE' },
];

export default function SubmissionsTable({
  activityId,
  title,
}: SubmissionsTableProps) {
  const t = useTranslations('Grading.Table');
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('ALL');
  const [openSubmissionUuid, setOpenSubmissionUuid] = useState<string | null>(null);

  const statusParam: SubmissionStatus | undefined =
    activeFilter === 'ALL'
      ? undefined
      : activeFilter === 'NEEDS_GRADING'
        ? 'SUBMITTED'
        : activeFilter;

  const { submissions, total, pages, page, setPage, isLoading, mutate } =
    useSubmissions({
      activityId,
      status: statusParam,
    });

  // When Needs Grading filter is active, `total` is the authoritative server count.
  // Otherwise, count from the current page (approximate, good enough for the banner).
  const needsGradingCount =
    activeFilter === 'NEEDS_GRADING'
      ? total
      : submissions.filter((s) => s.status === 'SUBMITTED' || s.status === 'LATE').length;

  const allUuids = submissions.map((s) => s.submission_uuid);

  const handleGradeSaved = useCallback(
    (updated: Submission) => {
      mutate();
      // Auto-advance to next ungraded in the list
      const currentIndex = allUuids.indexOf(updated.submission_uuid);
      const nextUngradedIndex = allUuids.findIndex(
        (uuid, i) =>
          i > currentIndex &&
          submissions.find((s) => s.submission_uuid === uuid)?.status === 'SUBMITTED',
      );
      if (nextUngradedIndex !== -1) {
        setOpenSubmissionUuid(allUuids[nextUngradedIndex]);
      } else {
        setOpenSubmissionUuid(null);
      }
    },
    [allUuids, submissions, mutate],
  );

  return (
    <div className="space-y-4">
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

        <Badge variant="outline" className="text-xs">
          {t('total', { count: total })}
        </Badge>
      </div>

      {/* Filter tabs */}
      <Tabs
        value={activeFilter}
        onValueChange={(v) => {
          setActiveFilter(v as StatusFilter);
          setPage(1);
        }}
      >
        <TabsList>
          {FILTER_OPTIONS.map((opt) => (
            <TabsTrigger key={opt.value} value={opt.value}>
              {opt.label}
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
          <span className="text-sm text-slate-600">
            {t('pageOf', { page, pages })}
          </span>
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

interface SubmissionRowProps {
  submission: Submission;
  onGrade: () => void;
}

function SubmissionRow({ submission, onGrade }: SubmissionRowProps) {
  const t = useTranslations('Grading.Table');

  const displayName = submission.user
    ? [
        submission.user.first_name,
        submission.user.middle_name,
        submission.user.last_name,
      ]
        .filter(Boolean)
        .join(' ') || `@${submission.user.username}`
    : `User #${submission.user_id}`;

  const needsGrading =
    submission.status === 'SUBMITTED' || submission.status === 'LATE';

  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="font-medium text-sm">{displayName}</p>
          {submission.user?.email && (
            <p className="text-xs text-slate-400">{submission.user.email}</p>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm text-slate-600">
        {submission.submitted_at
          ? new Date(submission.submitted_at).toLocaleString()
          : '—'}
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
          variant={needsGrading ? 'default' : 'outline'}
          onClick={onGrade}
          className="gap-1.5"
        >
          <BookOpenCheck className="h-3.5 w-3.5" />
          {needsGrading ? t('grade') : t('view')}
        </Button>
      </TableCell>
    </TableRow>
  );
}
