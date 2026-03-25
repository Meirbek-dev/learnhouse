'use client';

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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import { useGradingPanel } from '@/hooks/useGradingPanel';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { saveGrade } from '@services/grading/grading';
import SubmissionStatusBadge from './SubmissionStatusBadge';
import type { GradedItem, Submission, TeacherGradeInput } from '@/types/grading';

interface GradingPanelProps {
  submissionUuid: string | null;
  allSubmissionUuids: string[];
  onClose: () => void;
  onGradeSaved?: (updated: Submission) => void;
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

  // Reset / pre-fill inputs when the panel switches submission or loads data
  useEffect(() => {
    if (submissionUuid === null) {
      setScore('');
      setFeedback('');
      return;
    }
    setScore(submission?.final_score != null ? String(submission.final_score) : '');
    // F1 fix: pre-fill existing feedback instead of always clearing
    setFeedback(submission?.grading_json?.feedback ?? '');
  }, [submissionUuid, submission?.final_score, submission?.grading_json?.feedback]);

  // Navigation
  const currentIndex = submissionUuid ? allSubmissionUuids.indexOf(submissionUuid) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allSubmissionUuids.length - 1;

  // F6 fix: live score validation
  const scoreNum = Number.parseFloat(score);
  const scoreInvalid = score !== '' && (Number.isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100);

  const handleSaveGrade = useCallback(
    async (status: 'GRADED' | 'RETURNED') => {
      if (!submissionUuid || !accessToken) return;

      if (scoreInvalid || score === '') {
        toast.error(t('invalidScore'));
        return;
      }

      const input: TeacherGradeInput = {
        final_score: scoreNum,
        status,
        feedback,
      };

      setIsSaving(true);
      try {
        const updated = await saveGrade(submissionUuid, input, accessToken);
        toast.success(status === 'GRADED' ? t('gradeSaved') : t('returned'));
        onGradeSaved?.(updated);
        mutate();
      } catch {
        toast.error(t('saveFailed'));
      } finally {
        setIsSaving(false);
      }
    },
    [submissionUuid, accessToken, score, scoreNum, scoreInvalid, feedback, t, onGradeSaved, mutate],
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
            <div className="space-y-0.5">
              <SheetTitle className="text-base">{studentName}</SheetTitle>
              <SheetDescription className="text-xs">
                {t('attempt')} #{submission?.attempt_number ?? '—'} ·{' '}
                {submission?.submitted_at
                  ? new Date(submission.submitted_at).toLocaleString()
                  : t('notYetSubmitted')}
              </SheetDescription>
            </div>
            {submission && <SubmissionStatusBadge status={submission.status} />}
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
          <div className="flex items-start gap-4">
            <div className="space-y-1.5">
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
                  className={cn(
                    'w-28 text-center font-semibold',
                    scoreInvalid && 'border-red-500 focus-visible:ring-red-500',
                  )}
                />
                <span className="text-sm text-slate-500">/ 100</span>
              </div>
              {scoreInvalid && (
                <p className="text-xs text-red-600">{t('invalidScore')}</p>
              )}
            </div>

            {/* F5: show auto_score so teacher knows what auto-grader computed */}
            {submission?.auto_score != null && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-500">{t('autoScore')}</Label>
                <p className="text-sm font-semibold text-slate-600 pt-2">
                  {submission.auto_score}/100
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedback" className="text-sm font-medium">
              {t('feedback')}{' '}
              <span className="text-slate-400 font-normal">({t('optional')})</span>
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
            {/* F4 fix: confirmation dialog before "Return to student" */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isSaving || score === '' || scoreInvalid}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t('returnToStudent')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('confirmReturnTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('confirmReturnDesc')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleSaveGrade('RETURNED')}>
                    {t('confirm')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              disabled={isSaving || score === '' || scoreInvalid}
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
    return <p className="text-sm text-slate-500">{t('noBreakdown')}</p>;
  }

  return (
    <div className="space-y-4">
      {breakdown.needs_manual_review && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {t('manualReviewRequired')}
        </div>
      )}
      {breakdown.items.map((item, i) => (
        <AnswerItem key={item.item_id} item={item} index={i} t={t} />
      ))}
    </div>
  );
}

function AnswerItem({
  item,
  index,
  t,
}: {
  item: GradedItem;
  index: number;
  t: ReturnType<typeof useTranslations<'Grading.Panel'>>;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-800">
          {index + 1}. {item.item_text || item.item_id}
        </p>
        <span className="shrink-0 text-xs font-semibold text-slate-500">
          {item.score} / {item.max_score}
        </span>
      </div>

      {/* Student's answer */}
      {item.user_answer != null && (
        <div className="rounded bg-slate-100 px-3 py-2 text-sm text-slate-700">
          {typeof item.user_answer === 'string'
            ? item.user_answer
            : JSON.stringify(item.user_answer, null, 2)}
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
  );
}
