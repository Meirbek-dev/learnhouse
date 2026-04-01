'use client';

import { BookOpenCheck, ChevronLeft, ChevronRight, RotateCcw, Send, Wand2 } from 'lucide-react';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
} from '@/components/ui/alert-dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
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

type ItemFeedbackMap = Record<string, { score: string; feedback: string }>;

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

  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [itemFeedbacks, setItemFeedbacks] = useState<ItemFeedbackMap>({});
  const [isSaving, setIsSaving] = useState(false);

  // Dirty-state tracking.
  // We store the last-saved values in a ref so SWR revalidation never resets isDirty.
  // dirtyVersion is bumped after a successful save to force the memo to recompute.
  const initialRef = useRef<{ score: string; feedback: string; items: ItemFeedbackMap }>({
    score: '',
    feedback: '',
    items: {},
  });
  const [dirtyVersion, setDirtyVersion] = useState(0);

  // Unsaved-changes navigation guard
  const [pendingNavigate, setPendingNavigate] = useState<string | null>(null);
  const [pendingClose, setPendingClose] = useState(false);

  // Confirmation dialogs for destructive actions
  const [publishOpen, setPublishOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

  // Effect 1: reset everything when a different submission is opened (uuid changes).
  useEffect(() => {
    setScore('');
    setFeedback('');
    setItemFeedbacks({});
    initialRef.current = { score: '', feedback: '', items: {} };
    setDirtyVersion(0);
  }, [submissionUuid]);

  // Effect 2: pre-fill form from loaded data. Keyed on submission.id so that SWR
  // revalidation (same id, same uuid) does NOT re-run and wipe in-progress edits.
  const submissionId = submission?.id;
  useEffect(() => {
    if (!submission) return;
    const s = submission.final_score !== null ? String(submission.final_score) : '';
    const fb = submission.grading_json?.feedback ?? '';
    const items: ItemFeedbackMap = {};
    for (const item of submission.grading_json?.items ?? []) {
      items[item.item_id] = {
        score: item.score !== null ? String(item.score) : '',
        feedback: item.feedback ?? '',
      };
    }
    setScore(s);
    setFeedback(fb);
    setItemFeedbacks(items);
    initialRef.current = { score: s, feedback: fb, items };
    setDirtyVersion(0);
  }, [
    submissionId,
    submissionUuid,
    submission,
    submission?.final_score,
    submission?.grading_json?.feedback,
    submission?.grading_json?.items,
  ]);

  // isDirty: compares current state against last-saved ref values.
  // dirtyVersion in deps allows the memo to recompute after a save bumps it.
  const isDirty = useMemo(() => {
    void dirtyVersion;
    if (score !== initialRef.current.score) return true;
    if (feedback !== initialRef.current.feedback) return true;

    const itemIds = new Set([...Object.keys(initialRef.current.items), ...Object.keys(itemFeedbacks)]);
    for (const id of itemIds) {
      const current = itemFeedbacks[id] ?? { score: '', feedback: '' };
      const saved = initialRef.current.items[id] ?? { score: '', feedback: '' };
      if (current.score !== saved.score || current.feedback !== saved.feedback) return true;
    }

    return false;
  }, [score, feedback, itemFeedbacks, dirtyVersion]);

  // Navigation helpers with unsaved-changes guard
  const currentIndex = submissionUuid ? allSubmissionUuids.indexOf(submissionUuid) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allSubmissionUuids.length - 1;

  function tryNavigate(uuid: string) {
    if (isSaving || publishOpen || returnOpen) {
      return;
    }

    if (isDirty) {
      setPendingNavigate(uuid);
    } else {
      onNavigate?.(uuid);
    }
  }

  function tryClose() {
    if (isSaving || publishOpen || returnOpen) {
      return;
    }

    if (isDirty) {
      setPendingClose(true);
    } else {
      onClose();
    }
  }

  const unsavedOpen = (pendingNavigate !== null || pendingClose) && !isSaving && !publishOpen && !returnOpen;

  function handleDiscardAndContinue() {
    if (pendingNavigate) {
      onNavigate?.(pendingNavigate);
      setPendingNavigate(null);
    } else {
      onClose();
      setPendingClose(false);
    }

    setPublishOpen(false);
    setReturnOpen(false);
  }

  function handleCancelDiscard() {
    setPendingNavigate(null);
    setPendingClose(false);
    setPublishOpen(false);
    setReturnOpen(false);
  }

  // Score validation
  const scoreNum = Number.parseFloat(score);
  const scoreInvalid = score !== '' && (Number.isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100);

  // Auto-sum score: Σ(item.score) / Σ(item.max_score) × 100
  // Uses teacher-entered per-item values if present, otherwise falls back to auto-graded scores.
  const autoSumScore = useMemo(() => {
    const items = submission?.grading_json?.items ?? [];
    if (!items.length) return null;
    const totalMax = items.reduce((sum, it) => sum + it.max_score, 0);
    if (!totalMax) return null;
    const totalScore = items.reduce((sum, it) => {
      const raw = itemFeedbacks[it.item_id]?.score;
      const s = raw !== undefined && raw !== '' ? Number.parseFloat(raw) : it.score;
      return sum + (Number.isNaN(s) ? 0 : s);
    }, 0);
    return Math.round((totalScore / totalMax) * 100 * 100) / 100;
  }, [submission?.grading_json?.items, itemFeedbacks]);

  const handleSaveGrade = useCallback(
    async (status: 'GRADED' | 'PUBLISHED' | 'RETURNED') => {
      if (!submissionUuid || !accessToken) return;
      if (scoreInvalid || score === '') {
        toast.error(t('invalidScore'));
        return;
      }

      const item_feedback: ItemFeedback[] = Object.entries(itemFeedbacks)
        .filter(([item_id, val]) => {
          const initial = initialRef.current.items[item_id] ?? { score: '', feedback: '' };
          return val.score !== initial.score || val.feedback !== initial.feedback;
        })
        .map(([item_id, val]) => ({
          item_id,
          score: val.score !== '' ? Number.parseFloat(val.score) : undefined,
          feedback: val.feedback,
        }));

      const input: TeacherGradeInput = {
        final_score: scoreNum,
        status,
        feedback,
        item_feedback,
      };

      setIsSaving(true);
      try {
        const updated = await saveGrade(submissionUuid, input, accessToken);
        const msgKey = status === 'PUBLISHED' ? 'gradePublished' : status === 'RETURNED' ? 'returned' : 'gradeSaved';
        toast.success(t(msgKey));

        // Reset navigation guard and close confirmation dialogs to avoid stale modal overlap.
        setPendingNavigate(null);
        setPendingClose(false);
        setPublishOpen(false);
        setReturnOpen(false);

        // Mark form clean by updating the ref and bumping dirtyVersion.
        initialRef.current = { score, feedback, items: { ...itemFeedbacks } };
        setDirtyVersion((v) => v + 1);

        onGradeSaved?.(updated);
        mutate();
      } catch {
        toast.error(t('saveFailed'));
      } finally {
        setIsSaving(false);
      }
    },
    [
      submissionUuid,
      accessToken,
      score,
      scoreNum,
      scoreInvalid,
      feedback,
      itemFeedbacks,
      t,
      onGradeSaved,
      mutate,
    ],
  );

  const studentName = submission?.user
    ? [submission.user.first_name, submission.user.middle_name, submission.user.last_name].filter(Boolean).join(' ') ||
      `@${submission.user.username}`
    : '—';

  const canSave = !isSaving && score !== '' && !scoreInvalid;

  return (
    <>
      {/* Unsaved-changes confirmation dialog */}
      <AlertDialog
        open={unsavedOpen}
        onOpenChange={(open) => !open && handleCancelDiscard()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('unsavedTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('unsavedDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDiscard}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardAndContinue}>{t('discardAndContinue')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Drawer
        open={Boolean(submissionUuid)}
        onOpenChange={(open) => !open && tryClose()}
        direction="right"
      >
        <DrawerContent
          className="flex flex-col p-0"
          style={{ maxWidth: '48rem' }}
        >
          {/* Header — always visible, contains score entry */}
          <DrawerHeader className="border-b px-6 py-4 gap-0 space-y-3">
            {/* Student name + status + late badge */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <DrawerTitle className="text-base truncate">{studentName}</DrawerTitle>
                {submission?.is_late && (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-destructive bg-destructive/20 text-destructive text-xs"
                  >
                    {t('late')}
                  </Badge>
                )}
              </div>
              {submission && <SubmissionStatusBadge status={submission.status} />}
            </div>

            {/* Meta: attempt + submitted date */}
            <DrawerDescription className="text-xs">
              {t('attempt')} #{submission?.attempt_number ?? '—'} ·{' '}
              {submission?.submitted_at ? new Date(submission.submitted_at).toLocaleString() : t('notYetSubmitted')}
            </DrawerDescription>

            {/* Navigation buttons */}
            {allSubmissionUuids.length > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasPrev}
                  onClick={() => {
                    const prevUuid = allSubmissionUuids[currentIndex - 1];
                    if (prevUuid) tryNavigate(prevUuid);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('previous')}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {currentIndex + 1} / {allSubmissionUuids.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasNext}
                  onClick={() => {
                    const nextUuid = allSubmissionUuids[currentIndex + 1];
                    if (nextUuid) tryNavigate(nextUuid);
                  }}
                >
                  {t('next')}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            <Separator />

            {/* Score entry — always visible without scrolling */}
            <div className="flex items-end gap-6 pt-1">
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
                      scoreInvalid && 'border-destructive focus-visible:ring-destructive',
                    )}
                  />
                  <span className="text-sm text-muted-foreground">/ 100</span>
                </div>
                {scoreInvalid && <p className="text-xs text-destructive">{t('invalidScore')}</p>}
              </div>

              {/* Auto-score reference + one-click fill buttons */}
              <div className="flex flex-col gap-1.5">
                {(() => {
                  const autoScore = submission?.auto_score ?? null;
                  if (autoScore === null) return null;
                  return (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {t('autoScore')}: <strong>{autoScore}/100</strong>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 px-2 text-xs"
                        onClick={() => setScore(String(autoScore))}
                      >
                        <Wand2 className="h-3 w-3" />
                        {t('useAutoScore')}
                      </Button>
                    </div>
                  );
                })()}
                {autoSumScore !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {t('autoSum')}: <strong>{autoSumScore}/100</strong>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 px-2 text-xs"
                      onClick={() => setScore(String(autoSumScore))}
                    >
                      <Wand2 className="h-3 w-3" />
                      {t('useAutoSum')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </DrawerHeader>

          {/* Scrollable body — answers with per-item scoring */}
          <ScrollArea className="flex-1 px-6 py-4">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">{t('loading')}</div>
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
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">{t('noData')}</div>
            )}
          </ScrollArea>

          {/* Footer — overall feedback + action buttons */}
          <DrawerFooter className="border-t bg-muted px-6 py-4 gap-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="feedback"
                className="text-sm font-medium"
              >
                {t('feedback')} <span className="text-muted-foreground font-normal">({t('optional')})</span>
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

            <div className="flex items-center justify-between gap-2 flex-wrap">
              {/* Return to student — requires confirmation */}
              <AlertDialog
                open={returnOpen}
                onOpenChange={setReturnOpen}
              >
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canSave}
                  className="gap-1.5"
                  onClick={() => setReturnOpen(true)}
                >
                  <RotateCcw className="h-4 w-4" />
                  {t('returnToStudent')}
                </Button>
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
                {/* Save draft — teacher-visible only */}
                <Button
                  variant="outline"
                  disabled={!canSave}
                  onClick={() => handleSaveGrade('GRADED')}
                  className="gap-1.5"
                >
                  <BookOpenCheck className="h-4 w-4" />
                  {isSaving ? t('saving') : t('saveDraft')}
                </Button>

                {/* Publish — requires confirmation */}
                <AlertDialog
                  open={publishOpen}
                  onOpenChange={setPublishOpen}
                >
                  <Button
                    disabled={!canSave}
                    className="gap-1.5"
                    onClick={() => setPublishOpen(true)}
                  >
                    <Send className="h-4 w-4" />
                    {t('publishGrade')}
                  </Button>
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
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface SubmissionAnswersProps {
  submission: Submission;
  itemFeedbacks: ItemFeedbackMap;
  onItemFeedbackChange: (itemId: string, field: 'score' | 'feedback', value: string) => void;
  t: ReturnType<typeof useTranslations<'Grading.Panel'>>;
}

function SubmissionAnswers({ submission, itemFeedbacks, onItemFeedbackChange, t }: SubmissionAnswersProps) {
  const breakdown = submission.grading_json;
  const isEditable = needsTeacherAction(submission.status) || submission.status === 'GRADED';

  if (!breakdown?.items?.length) {
    return <p className="text-sm text-muted-foreground">{t('noBreakdown')}</p>;
  }

  return (
    <div className="space-y-4">
      {breakdown.needs_manual_review && (
        <div className="rounded-md border border-secondary/50 bg-secondary/10 px-4 py-2 text-sm text-primary">
          {t('manualReviewRequired')}
        </div>
      )}
      {breakdown.items.map((item, i) => (
        <AnswerItem
          key={item.item_id}
          item={item}
          index={i}
          itemFeedback={itemFeedbacks[item.item_id] ?? { score: '', feedback: '' }}
          isEditable={isEditable}
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
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          {item.needs_manual_review && (
            <Badge
              variant="outline"
              className="border-secondary/20 bg-secondary/10 text-secondary-foreground text-xs"
            >
              {t('needsReview')}
            </Badge>
          )}
          <p className="text-sm font-medium text-foreground">
            {index + 1}. {item.item_text || item.item_id}
          </p>
        </div>
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">
          {item.score} / {item.max_score}
        </span>
      </div>

      {item.user_answer !== null && (
        <div className="rounded bg-muted/70 px-3 py-2 text-sm text-muted-foreground">
          <span className="text-xs font-medium text-muted-foreground mr-1">{t('studentAnswer')}:</span>
          {typeof item.user_answer === 'string' ? item.user_answer : JSON.stringify(item.user_answer, null, 2)}
        </div>
      )}

      {item.correct === false && item.correct_answer !== null && (
        <div className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span className="text-xs font-medium text-emerald-600 mr-1">{t('correctAnswer')}:</span>
          {typeof item.correct_answer === 'string' ? item.correct_answer : JSON.stringify(item.correct_answer)}
        </div>
      )}

      {item.feedback && !item.needs_manual_review && (
        <p className="text-xs text-muted-foreground italic">{item.feedback}</p>
      )}

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
                  className={cn('w-20 text-center text-xs', itemScoreInvalid && 'border-destructive')}
                />
                <span className="text-xs text-muted-foreground">/ {item.max_score}</span>
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
