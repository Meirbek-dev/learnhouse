'use client';

/**
 * SubmissionResult
 *
 * Shows a student their grading breakdown: score, teacher feedback,
 * per-item results (question text, their answer, correct answer, item feedback).
 *
 * Rendered inside SubmissionShell when status is GRADED or RETURNED.
 */

import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { Submission, GradedItem } from '@/types/grading';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface SubmissionResultProps {
  submission: Submission;
}

export default function SubmissionResult({ submission }: SubmissionResultProps) {
  const t = useTranslations('Grading.Result');
  const breakdown = submission.grading_json;
  const score = submission.final_score;

  const passed = score != null && score >= 50;
  const scoreColor = score == null ? 'text-slate-500' : passed ? 'text-emerald-600' : 'text-rose-600';
  // Only show teacher feedback and item breakdown if grade is published
  const isPublished = submission.status === 'PUBLISHED' || submission.status === 'RETURNED';

  return (
    <div className="space-y-6">
      {/* Score badge */}
      <div className="flex items-center justify-between rounded-lg border bg-slate-50 px-5 py-4">
        <div>
          <p className="text-sm text-slate-500">{t('score')}</p>
          <p className={cn('text-3xl font-bold', scoreColor)}>{score != null ? `${score}/100` : '—'}</p>
        </div>
        {score != null && (
          <span
            className={cn(
              'rounded-full px-3 py-1 text-sm font-semibold',
              passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700',
            )}
          >
            {passed ? t('passed') : t('failed')}
          </span>
        )}
      </div>

      {/* Auto-score note */}
      {submission.auto_score != null && submission.auto_score !== submission.final_score && (
        <p className="text-xs text-slate-500">
          {t('autoScore')}: {submission.auto_score}/100
        </p>
      )}

      {/* Teacher feedback — only visible after publishing */}
      {isPublished && breakdown?.feedback && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-xs font-medium text-blue-700 mb-1">{t('teacherFeedback')}</p>
          <p className="text-sm text-blue-900 italic">&ldquo;{breakdown.feedback}&rdquo;</p>
        </div>
      )}

      {/* Per-item breakdown — only visible after publishing */}
      {isPublished && breakdown?.items && breakdown.items.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">{t('breakdown')}</h3>
          {breakdown.items.map((item, i) => (
            <ResultItem
              key={item.item_id}
              item={item}
              index={i}
            />
          ))}
        </div>
      )}

      {/* Waiting state */}
      {(!breakdown?.items || breakdown.items.length === 0) && score == null && (
        <p className="text-sm text-slate-500 italic">{t('waitingForGrade')}</p>
      )}
    </div>
  );
}

function ResultItem({ item, index }: { item: GradedItem; index: number }) {
  const t = useTranslations('Grading.Result');

  const icon = item.needs_manual_review ? (
    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
  ) : item.correct ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
  ) : (
    <XCircle className="h-4 w-4 text-rose-500 shrink-0" />
  );

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        {icon}
        <div className="flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-4">
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
              <span className="text-xs font-medium text-slate-500 mr-2">{t('yourAnswer')}:</span>
              {typeof item.user_answer === 'string' ? item.user_answer : JSON.stringify(item.user_answer)}
            </div>
          )}

          {/* Correct answer (only show if wrong) */}
          {item.correct === false && item.correct_answer != null && (
            <div className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <span className="text-xs font-medium text-emerald-600 mr-2">{t('correctAnswer')}:</span>
              {typeof item.correct_answer === 'string' ? item.correct_answer : JSON.stringify(item.correct_answer)}
            </div>
          )}

          {/* Item feedback */}
          {item.feedback && <p className="text-xs text-slate-500 italic">{item.feedback}</p>}

          {item.needs_manual_review && <p className="text-xs text-amber-700 font-medium">{t('pendingReview')}</p>}
        </div>
      </div>
      <Separator />
    </div>
  );
}
