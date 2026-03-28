'use client';

import { BookOpenCheck, ChevronLeft, ChevronRight, Eye, RotateCcw, Send } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { GradedItem, ItemFeedback, Submission, TeacherGradeInput } from '@/types/grading';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import SubmissionStatusBadge from './SubmissionStatusBadge';
import { useGradingPanel } from '@/hooks/useGradingPanel';
import { saveGrade } from '@services/grading/grading';
import { needsTeacherAction } from '@/types/grading';

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
  // Per-item feedback: map of item_id → { score, feedback }
  const [itemFeedbacks, setItemFeedbacks] = useState<Record<string, { score: string; feedback: string }>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Reset / pre-fill inputs when the panel switches or loads
  useEffect(() => {
    if (submissionUuid === null) {
      setScore('');
      setFeedback('');
      setItemFeedbacks({});
      return;
    }
    setScore(submission?.final_score != null ? String(submission.final_score) : '');
    setFeedback(submission?.grading_json?.feedback ?? '');

    // Pre-fill item-level feedback from existing grading
    if (submission?.grading_json?.items) {
      const existing: Record<string, { score: string; feedback: string }> = {};
      for (const item of submission.grading_json.items) {
        existing[item.item_id] = {
          score: item.score != null ? String(item.score) : '',
          feedback: item.feedback ?? '',
        };
      }
      setItemFeedbacks(existing);
    } else {
      setItemFeedbacks({});
    }
  }, [submissionUuid, submission?.final_score, submission?.grading_json]);

  // Navigation
  const currentIndex = submissionUuid ? allSubmissionUuids.indexOf(submissionUuid) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allSubmissionUuids.length - 1;

  // Score validation
  const scoreNum = Number.parseFloat(score);
  const scoreInvalid = score !== '' && (Number.isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100);

  const buildItemFeedbackList = (): ItemFeedback[] => {
    return Object.entries(itemFeedbacks).map(([item_id, val]) => ({
      item_id,
      score: val.score !== '' ? Number.parseFloat(val.score) : undefined,
      feedback: val.feedback,
    }));
  };

  const handleSaveGrade = useCallback(
    async (status: 'GRADED' | 'PUBLISHED' | 'RETURNED') => {
      if (!submissionUuid || !accessToken) return;

      if (scoreInvalid || score === '') {
        toast.error(t('invalidScore'));
        return;
      }

      const input: TeacherGradeInput = {
        final_score: scoreNum,
        status,
        feedback,
        item_feedback: buildItemFeedbackList(),
      };

      setIsSaving(true);
      try {
        const updated = await saveGrade(submissionUuid, input, accessToken);
        const msgKey = status === 'PUBLISHED' ? 'gradePublished' : status === 'RETURNED' ? 'returned' : 'gradeSaved';
        toast.success(t(msgKey));
        onGradeSaved?.(updated);
        mutate();
      } catch {
        toast.error(t('saveFailed'));
      } finally {
        setIsSaving(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [submissionUuid, accessToken, score, scoreNum, scoreInvalid, feedback, itemFeedbacks, t, onGradeSaved, mutate],
  );

  const studentName = submission?.user
    ? [submission.user.first_name, submission.user.middle_name, submission.user.last_name].filter(Boolean).join(' ') ||
      `@${submission.user.username}`
    : '—';

  const canSave = !isSaving && score !== '' && !scoreInvalid;

  return (
    <Sheet
      open={Boolean(submissionUuid)}
      onOpenChange={(open) => !open && onClose()}
    >
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
                {submission?.submitted_at ? new Date(submission.submitted_at).toLocaleString() : t('notYetSubmitted')}
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
                onClick={() => onNavigate?.(allSubmissionUuids[currentIndex - 1]!)}
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
                onClick={() => onNavigate?.(allSubmissionUuids[currentIndex + 1]!)}
              >
                {t('next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </SheetHeader>

        {/* Body — student answers with inline item scoring */}
        <ScrollArea className="flex-1 px-6 py-4">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center text-sm text-slate-500">{t('loading')}</div>
          ) : submission ? (
            <SubmissionAnswers
              submission={submission}
              itemFeedbacks={itemFeedbacks}
              onItemFeedbackChange={(itemId, field, value) =>
                setItemFeedbacks((prev) => ({
                  ...prev,
                  [itemId]: { ...(prev[itemId] ?? { score: '', feedback: '' }), [field]: value },
                }))
              }
              t={t}
            />
          ) : (
            <div className="flex h-32 items-center justify-center text-sm text-slate-500">{t('noData')}</div>
          )}
        </ScrollArea>

        {/* Grade entry footer */}
        <div className="border-t bg-slate-50 px-6 py-4 space-y-4">
          {/* Overall score + auto-score reference */}
          <div className="flex items-start gap-6">
            <div className="space-y-1.5">
              <Label
                htmlFor="final-score"
                className="text-sm font-medium"
              >
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
              {scoreInvalid && <p className="text-xs text-red-600">{t('invalidScore')}</p>}
            </div>

            {/* Auto-score so teacher knows what the auto-grader computed */}
            {submission?.auto_score != null && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-500">{t('autoScore')}</Label>
                <p className="text-sm font-semibold text-slate-600 pt-2">{submission.auto_score}/100</p>
              </div>
            )}
          </div>

          {/* Overall feedback */}
          <div className="space-y-1.5">
            <Label
              htmlFor="feedback"
              className="text-sm font-medium"
            >
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

          {/* Action buttons: Save Draft | Publish | Return */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Return to student — requires confirmation */}
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canSave}
                    className="gap-1.5"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {t('returnToStudent')}
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('confirmReturnTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('confirmReturnDesc')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleSaveGrade('RETURNED')}>{t('confirm')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex items-center gap-2">
              {/* Save grade (teacher draft — student cannot see yet) */}
              <Button
                variant="outline"
                disabled={!canSave}
                onClick={() => handleSaveGrade('GRADED')}
                className="gap-1.5"
              >
                <BookOpenCheck className="h-4 w-4" />
                {isSaving ? t('saving') : t('saveDraft')}
              </Button>

              {/* Publish — confirm before making visible to student */}
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      disabled={!canSave}
                      className="gap-1.5"
                    >
                      <Send className="h-4 w-4" />
                      {t('publishGrade')}
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('confirmPublishTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>{t('confirmPublishDesc')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleSaveGrade('PUBLISHED')}>{t('confirm')}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface SubmissionAnswersProps {
  submission: Submission;
  itemFeedbacks: Record<string, { score: string; feedback: string }>;
  onItemFeedbackChange: (itemId: string, field: 'score' | 'feedback', value: string) => void;
  t: ReturnType<typeof useTranslations<'Grading.Panel'>>;
}

function SubmissionAnswers({ submission, itemFeedbacks, onItemFeedbackChange, t }: SubmissionAnswersProps) {
  const breakdown = submission.grading_json;
  const isEditable = needsTeacherAction(submission.status) || submission.status === 'GRADED';

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
        <AnswerItem
          key={item.item_id}
          item={item}
          index={i}
          itemFeedback={itemFeedbacks[item.item_id] ?? { score: '', feedback: '' }}
          isEditable={isEditable && item.needs_manual_review}
          onFeedbackChange={(field, value) => onItemFeedbackChange(item.item_id, field, value)}
          t={t}
        />
      ))}
    </div>
  );
}

interface AnswerItemProps {
  item: GradedItem;
  index: number;
  itemFeedback: { score: string; feedback: string };
  isEditable: boolean;
  onFeedbackChange: (field: 'score' | 'feedback', value: string) => void;
  t: ReturnType<typeof useTranslations<'Grading.Panel'>>;
}

function AnswerItem({ item, index, itemFeedback, isEditable, onFeedbackChange, t }: AnswerItemProps) {
  const scoreNum = Number.parseFloat(itemFeedback.score);
  const itemScoreInvalid =
    itemFeedback.score !== '' && (Number.isNaN(scoreNum) || scoreNum < 0 || scoreNum > item.max_score);

  return (
    <div className="rounded-lg border bg-white p-4 space-y-3">
      {/* Question header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          {item.needs_manual_review && (
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-50 text-amber-700 text-xs"
            >
              {t('needsReview')}
            </Badge>
          )}
          <p className="text-sm font-medium text-slate-800">
            {index + 1}. {item.item_text || item.item_id}
          </p>
        </div>
        <span className="shrink-0 text-xs font-semibold text-slate-500">
          {item.score} / {item.max_score}
        </span>
      </div>

      {/* Student's answer */}
      {item.user_answer != null && (
        <div className="rounded bg-slate-100 px-3 py-2 text-sm text-slate-700">
          <span className="text-xs font-medium text-slate-500 mr-1">{t('studentAnswer')}:</span>
          {typeof item.user_answer === 'string' ? item.user_answer : JSON.stringify(item.user_answer, null, 2)}
        </div>
      )}

      {/* Correct answer (auto-graded items only) */}
      {item.correct === false && item.correct_answer != null && (
        <div className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span className="text-xs font-medium text-emerald-600 mr-1">{t('correctAnswer')}:</span>
          {typeof item.correct_answer === 'string' ? item.correct_answer : JSON.stringify(item.correct_answer)}
        </div>
      )}

      {/* Existing auto-feedback */}
      {item.feedback && !item.needs_manual_review && <p className="text-xs text-slate-500 italic">{item.feedback}</p>}

      {/* Per-item scoring controls for manual-review items */}
      {isEditable && (
        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium">{t('itemScore')}</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={item.max_score}
                  step={0.5}
                  placeholder="0"
                  value={itemFeedback.score}
                  onChange={(e) => onFeedbackChange('score', e.target.value)}
                  className={cn('w-20 text-center text-xs', itemScoreInvalid && 'border-red-500')}
                />
                <span className="text-xs text-slate-400">/ {item.max_score}</span>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">{t('itemFeedback')}</Label>
            <Textarea
              rows={1}
              placeholder={t('itemFeedbackPlaceholder')}
              value={itemFeedback.feedback}
              onChange={(e) => onFeedbackChange('feedback', e.target.value)}
              className="text-xs resize-none"
            />
          </div>
        </div>
      )}

      <Separator />
    </div>
  );
}
