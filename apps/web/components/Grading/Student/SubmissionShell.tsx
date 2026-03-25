'use client';

/**
 * SubmissionShell
 *
 * Wraps any student-facing assessment UI and adds:
 *   1. A status banner (DRAFT / SUBMITTED / GRADED / RETURNED / LATE)
 *   2. A "Submit for Grading" footer with SubmitButton
 *   3. Score + feedback display after grading
 *
 * Replaces AssignmentStudentActivity's ad-hoc task list that had
 * zero unified submit action — students could fill out tasks forever
 * with no way to signal they were done.
 *
 * Usage:
 *   <SubmissionShell activityId={activity.id} assessmentType="ASSIGNMENT">
 *     <AssignmentStudentActivity />
 *   </SubmissionShell>
 */

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { BookOpenCheck, CheckCircle2, Clock4, RotateCcw, SendHorizonal } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import PageLoading from '@components/Objects/Loaders/PageLoading';

import { useMySubmission } from '@/hooks/useMySubmission';
import SubmitButton from './SubmitButton';
import SubmissionStatusBadge from '../SubmissionStatusBadge';
import type { AssessmentType, Submission } from '@/types/grading';

interface SubmissionShellProps {
  activityId: number;
  assessmentType: AssessmentType;
  /** The assessment content (task forms, quiz questions, etc.) */
  children: ReactNode;
  /** Extra answers to forward to the submit endpoint (leave empty for ASSIGNMENT) */
  answersPayload?: Record<string, unknown>;
  violationCount?: number;
}

// Status-specific banner config
const STATUS_BANNERS = {
  SUBMITTED: {
    icon: SendHorizonal,
    variant: 'default' as const,
    titleKey: 'bannerSubmittedTitle',
    descKey: 'bannerSubmittedDesc',
    iconClass: 'text-blue-600',
  },
  GRADED: {
    icon: CheckCircle2,
    variant: 'default' as const,
    titleKey: 'bannerGradedTitle',
    descKey: 'bannerGradedDesc',
    iconClass: 'text-emerald-600',
  },
  LATE: {
    icon: Clock4,
    variant: 'destructive' as const,
    titleKey: 'bannerLateTitle',
    descKey: 'bannerLateDesc',
    iconClass: '',
  },
  RETURNED: {
    icon: RotateCcw,
    variant: 'default' as const,
    titleKey: 'bannerReturnedTitle',
    descKey: 'bannerReturnedDesc',
    iconClass: 'text-amber-600',
  },
};

export default function SubmissionShell({
  activityId,
  assessmentType,
  children,
  answersPayload,
  violationCount,
}: SubmissionShellProps) {
  const t = useTranslations('Grading.SubmissionShell');
  const { submission, isLoading, mutate } = useMySubmission(activityId);

  if (isLoading) return <PageLoading />;

  const status = submission?.status ?? null;
  const bannerConfig = status && status !== 'DRAFT' ? STATUS_BANNERS[status] : null;

  const handleSubmitted = (updated: Submission) => {
    // Revalidate so the status banner reflects the new SUBMITTED state
    void mutate();
    // Parent components can also listen via onSubmitted if needed
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Status banner — shown for SUBMITTED / GRADED / RETURNED / LATE */}
      {bannerConfig && (
        <Alert variant={bannerConfig.variant}>
          <bannerConfig.icon className={`h-4 w-4 ${bannerConfig.iconClass}`} />
          <AlertTitle className="flex items-center gap-2">
            {t(bannerConfig.titleKey)}
            <SubmissionStatusBadge status={status!} />
          </AlertTitle>
          <AlertDescription>{t(bannerConfig.descKey)}</AlertDescription>

          {/* Score display once graded */}
          {status === 'GRADED' && submission?.final_score !== null && (
            <div className="mt-3 flex items-center gap-2">
              <BookOpenCheck className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold">
                {t('score')}: {submission.final_score}/100
              </span>
            </div>
          )}

          {/* Teacher feedback */}
          {submission?.grading_json?.feedback && (
            <p className="mt-2 text-sm italic text-slate-600">
              &ldquo;{submission.grading_json.feedback}&rdquo;
            </p>
          )}
        </Alert>
      )}

      {/* Assessment content */}
      {children}

      {/* Submit footer — only shown for DRAFT or no submission yet */}
      {(status === 'DRAFT' || status === null) && (
        <>
          <Separator />
          <div className="flex items-center justify-between rounded-md border bg-slate-50 px-5 py-3">
            <p className="text-sm text-slate-600">{t('readyToSubmit')}</p>
            <SubmitButton
              activityId={activityId}
              assessmentType={assessmentType}
              currentStatus={status}
              answersPayload={answersPayload}
              violationCount={violationCount}
              onSubmitted={handleSubmitted}
            />
          </div>
        </>
      )}

      {/* Re-submit footer for RETURNED assignments */}
      {status === 'RETURNED' && (
        <>
          <Separator />
          <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-5 py-3">
            <p className="text-sm text-amber-800">{t('returnedResubmit')}</p>
            <SubmitButton
              activityId={activityId}
              assessmentType={assessmentType}
              currentStatus={null} // allow re-submit
              answersPayload={answersPayload}
              violationCount={violationCount}
              onSubmitted={handleSubmitted}
            />
          </div>
        </>
      )}
    </div>
  );
}
