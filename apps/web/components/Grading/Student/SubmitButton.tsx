'use client';

/**
 * SubmitButton
 *
 * Unified "Submit for Grading" button for all assessment types.
 *
 * Replaces the complete absence of a submission action in
 * AssignmentStudentActivity — previously students could fill out tasks
 * but had no way to mark their work as ready for teacher review.
 *
 * Features:
 * - Calls POST /grading/submit/{activity_id} on click
 * - Shows confirmation dialog before submitting
 * - Displays loading / success states
 * - Disabled when already submitted / graded
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { SendHorizonal } from 'lucide-react';

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

import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { submitAssessment } from '@services/grading/grading';
import type { AssessmentType, Submission, SubmissionStatus } from '@/types/grading';

interface SubmitButtonProps {
  activityId: number;
  assessmentType: AssessmentType;
  /** Current submission status — used to disable the button when not needed */
  currentStatus?: SubmissionStatus | null;
  /** Arbitrary answers payload; omit for manual-graded types (ASSIGNMENT) */
  answersPayload?: Record<string, unknown>;
  violationCount?: number;
  onSubmitted?: (submission: Submission) => void;
  className?: string;
}

const NON_SUBMITTABLE_STATUSES: SubmissionStatus[] = new Set(['SUBMITTED', 'GRADED', 'LATE']);

export default function SubmitButton({
  activityId,
  assessmentType,
  currentStatus,
  answersPayload = {},
  violationCount = 0,
  onSubmitted,
  className,
}: SubmitButtonProps) {
  const t = useTranslations('Grading.SubmitButton');
  const session = usePlatformSession();
  const accessToken = session?.data?.tokens?.access_token ?? '';

  const [isSubmitting, setIsSubmitting] = useState(false);

  const alreadySubmitted = currentStatus
    ? NON_SUBMITTABLE_STATUSES.has(currentStatus)
    : false;

  const handleConfirm = useCallback(async () => {
    if (!accessToken) {
      toast.error(t('notAuthenticated'));
      return;
    }

    setIsSubmitting(true);
    try {
      const submission = await submitAssessment(
        activityId,
        assessmentType,
        answersPayload,
        accessToken,
        violationCount,
      );
      toast.success(t('submitted'));
      onSubmitted?.(submission);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('submitFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }, [accessToken, activityId, assessmentType, answersPayload, violationCount, onSubmitted, t]);

  if (alreadySubmitted) {
    return (
      <Button
        variant="outline"
        disabled
        className={className}
      >
        <SendHorizonal className="mr-2 h-4 w-4" />
        {t('alreadySubmitted')}
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          disabled={isSubmitting}
          className={className}
        >
          <SendHorizonal className="mr-2 h-4 w-4" />
          {isSubmitting ? t('submitting') : t('submitForGrading')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('confirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('confirmDescription')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            {t('confirmSubmit')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
