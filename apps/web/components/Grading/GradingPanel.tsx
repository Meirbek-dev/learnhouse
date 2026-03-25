'use client';

/**
 * GradingPanel
 *
 * Teacher side panel for reviewing a student submission and entering a grade.
 *
 * Replaces:
 * - EvaluateAssignment.tsx (modal with NO grade input)
 * - 3 nested Context Providers (AssignmentProvider, AssignmentsTaskProvider,
 *   AssignmentSubmissionProvider) stacked inside a modal trigger render prop
 * - globalThis.location.reload() after rejection
 *
 * Features:
 * - Real <input type="number"> for the final score (0–100)
 * - Optional per-item feedback display from grading_json
 * - Previous / Next navigation between ungraded submissions
 * - Return-to-student action (sets status to RETURNED)
 * - Auto-advances to next ungraded submission after saving grade
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { BookOpenCheck, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useGradingPanel } from '@/hooks/useGradingPanel';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { saveGrade } from '@services/grading/grading';
import SubmissionStatusBadge from './SubmissionStatusBadge';
import type { Submission, TeacherGradeInput } from '@/types/grading';

interface GradingPanelProps {
  /** uuid of the submission currently open in the panel (null = closed) */
  submissionUuid: string | null;
  /** All submission uuids in the current list so we can navigate */
  allSubmissionUuids: string[];
  onClose: () => void;
  /** Called after a grade is saved so the parent can refresh its list */
  onGradeSaved?: (updated: Submission) => void;
  /** Called when the user clicks Prev/Next navigation in the panel header */
  onNavigate?: (uuid: string) => void;
}

export default function GradingPanel({
  submissionUuid,
  allSubmissionUuids,
  onClose,
  onGradeSaved,
  onNavigate,
}: GradingPanelProps) {
  const t = useTranslations('Grading.Panel');
  const session = usePlatformSession();
  const accessToken = session?.data?.tokens?.access_token ?? '';

  const { submission, isLoading, mutate } = useGradingPanel(submissionUuid);

  const [score, setScore] = useState<string>('');
  const [feedback, setFeedback] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset inputs when the panel switches to a different submission (or loads data)
  useEffect(() => {
    if (submissionUuid === null) {
      setScore('');
      setFeedback('');
      return;
    }
    // Pre-fill with existing grade if already graded; use loose != to guard both null and undefined
    setScore(submission?.final_score != null ? String(submission.final_score) : '');
    setFeedback('');
  }, [submissionUuid, submission?.final_score]);

  // Navigation between submissions
  const currentIndex = submissionUuid
    ? allSubmissionUuids.indexOf(submissionUuid)
    : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allSubmissionUuids.length - 1;

  const handleSaveGrade = useCallback(
    async (status: 'GRADED' | 'RETURNED') => {
      if (!submissionUuid || !accessToken) return;

      const numScore = Number.parseFloat(score);
      if (Number.isNaN(numScore) || numScore < 0 || numScore > 100) {
        toast.error(t('invalidScore'));
        return;
      }

      const input: TeacherGradeInput = {
        final_score: numScore,
        status,
        feedback,
      };

      setIsSaving(true);
      try {
        const updated = await saveGrade(submissionUuid, input, accessToken);
        toast.success(status === 'GRADED' ? t('gradeSaved') : t('returned'));
        onGradeSaved?.(updated);
        mutate();

        // Auto-advance: parent's onGradeSaved handler moves to next ungraded
      } catch {
        toast.error(t('saveFailed'));
      } finally {
        setIsSaving(false);
      }
    },
    [submissionUuid, accessToken, score, feedback, t, onGradeSaved, mutate],
  );

  const studentName = submission?.user
    ? [
        submission.user.first_name,
        submission.user.middle_name,
        submission.user.last_name,
      ]
        .filter(Boolean)
        .join(' ') || `@${submission.user.username}`
    : '—';

  return (
    <Sheet open={Boolean(submissionUuid)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full max-w-2xl flex-col p-0 sm:max-w-2xl"
      >
        {/* Header */}
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <SheetTitle className="text-base">
                {studentName}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {submission?.submitted_at
                  ? new Date(submission.submitted_at).toLocaleString()
                  : t('notYetSubmitted')}
              </SheetDescription>
            </div>
            {submission && (
              <SubmissionStatusBadge status={submission.status} />
            )}
          </div>

          {/* Navigation */}
          {allSubmissionUuids.length > 1 && (
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasPrev}
                onClick={() => onNavigate?.(allSubmissionUuids[currentIndex - 1])}
              >
                <ChevronLeft className="h-4 w-4" />
                {t('previous')}
              </Button>
              <span className="text-xs text-slate-500">
                {currentIndex + 1} / {allSubmissionUuids.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => onNavigate?.(allSubmissionUuids[currentIndex + 1])}
              >
                {t('next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </SheetHeader>

        {/* Body — student answers */}
        <ScrollArea className="flex-1 px-6 py-4">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center text-sm text-slate-500">
              {t('loading')}
            </div>
          ) : submission ? (
            <SubmissionAnswers submission={submission} />
          ) : (
            <div className="flex h-32 items-center justify-center text-sm text-slate-500">
              {t('noData')}
            </div>
          )}
        </ScrollArea>

        {/* Grade entry footer */}
        <div className="border-t bg-slate-50 px-6 py-4 space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="final-score" className="text-sm font-medium">
                {t('finalScore')}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="final-score"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  placeholder="0–100"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  className="w-28 text-center font-semibold"
                />
                <span className="text-sm text-slate-500">/ 100</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedback" className="text-sm font-medium">
              {t('feedback')} <span className="text-slate-400 font-normal">({t('optional')})</span>
            </Label>
            <Textarea
              id="feedback"
              rows={2}
              placeholder={t('feedbackPlaceholder')}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Button
              variant="destructive"
              size="sm"
              disabled={isSaving}
              onClick={() => handleSaveGrade('RETURNED')}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {t('returnToStudent')}
            </Button>

            <Button
              disabled={isSaving || !score}
              onClick={() => handleSaveGrade('GRADED')}
              className="gap-2"
            >
              <BookOpenCheck className="h-4 w-4" />
              {isSaving ? t('saving') : t('saveGrade')}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SubmissionAnswers({ submission }: { submission: Submission }) {
  const t = useTranslations('Grading.Panel');
  const breakdown = submission.grading_json;

  if (!breakdown?.items?.length) {
    return (
      <p className="text-sm text-slate-500">{t('noBreakdown')}</p>
    );
  }

  return (
    <div className="space-y-4">
      {breakdown.needs_manual_review && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {t('manualReviewRequired')}
        </div>
      )}
      {breakdown.items.map((item, i) => (
        <div key={item.item_id} className="space-y-1.5">
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium text-slate-800">
              {i + 1}. {item.item_text || item.item_id}
            </p>
            <span className="shrink-0 text-xs font-semibold text-slate-500">
              {item.score} / {item.max_score}
            </span>
          </div>
          {item.user_answer !== null && (
            <div className="rounded bg-slate-100 px-3 py-2 text-sm text-slate-700">
              {typeof item.user_answer === 'string'
                ? item.user_answer
                : JSON.stringify(item.user_answer)}
            </div>
          )}
          {item.needs_manual_review && (
            <p className="text-xs text-amber-700 font-medium">{t('needsReview')}</p>
          )}
          {item.feedback && !item.needs_manual_review && (
            <p className="text-xs text-slate-500">{item.feedback}</p>
          )}
          <Separator />
        </div>
      ))}
    </div>
  );
}

