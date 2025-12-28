'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, CheckCircle2, Flag } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface ExamSubmissionReviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalQuestions: number;
  answeredCount: number;
  unansweredQuestions: number[];
  flaggedQuestions?: number[];
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export default function ExamSubmissionReview({
  open,
  onOpenChange,
  totalQuestions,
  answeredCount,
  unansweredQuestions,
  flaggedQuestions = [],
  onConfirm,
  isSubmitting = false,
}: ExamSubmissionReviewProps) {
  const t = useTranslations('Activities.ExamActivity');
  const [confirmChecked, setConfirmChecked] = useState(false);

  const hasUnanswered = unansweredQuestions.length > 0;
  const hasFlagged = flaggedQuestions.length > 0;

  const handleConfirm = () => {
    if (!confirmChecked) return;
    onConfirm();
  };

  // Reset checkbox when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmChecked(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      <AlertDialogContent
        size="default"
        className="max-h-[90vh] overflow-y-auto"
      >
        <AlertDialogHeader>
          <AlertDialogMedia>
            {hasUnanswered ? (
              <AlertTriangle className="size-6 text-orange-500" />
            ) : (
              <CheckCircle2 className="size-6 text-green-600" />
            )}
          </AlertDialogMedia>
          <AlertDialogTitle>{t('confirmSubmission')}</AlertDialogTitle>
          <AlertDialogDescription
            render={
              <div className="space-y-4 text-left">
                <p className="text-sm text-gray-600">{t('confirmSubmissionMessage')}</p>

                {/* Summary Stats */}
                <div className="rounded-lg border bg-gray-50 p-4">
                  <div className="grid gap-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">{t('totalQuestions')}:</span>
                      <span className="font-semibold">{totalQuestions}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-green-600">{t('answered')}:</span>
                      </div>
                      <span className="font-semibold text-green-600">{answeredCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-600">{t('unanswered')}:</span>
                      </div>
                      <span className="font-semibold text-gray-600">{unansweredQuestions.length}</span>
                    </div>
                    {hasFlagged && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Flag className="h-4 w-4 text-orange-500" />
                          <span className="text-orange-600">{t('flagged')}:</span>
                        </div>
                        <span className="font-semibold text-orange-600">{flaggedQuestions.length}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Unanswered Questions List */}
                {hasUnanswered && (
                  <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                    <div className="mb-2 flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-orange-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-orange-800">
                          {t('unansweredQuestionsWarning', { count: unansweredQuestions.length })}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {unansweredQuestions.slice(0, 20).map((questionNum) => (
                            <span
                              key={questionNum}
                              className="inline-flex h-6 w-6 items-center justify-center rounded bg-orange-100 text-xs font-medium text-orange-700"
                            >
                              {questionNum}
                            </span>
                          ))}
                          {unansweredQuestions.length > 20 && (
                            <span className="inline-flex items-center px-2 text-xs text-orange-700">
                              +{unansweredQuestions.length - 20} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Flagged Questions List */}
                {hasFlagged && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <div className="mb-2 flex items-start gap-2">
                      <Flag className="mt-0.5 h-4 w-4 text-blue-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-800">
                          {t('flaggedForReview')}: {flaggedQuestions.length}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {flaggedQuestions.slice(0, 20).map((questionNum) => (
                            <span
                              key={questionNum}
                              className="inline-flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-xs font-medium text-blue-700"
                            >
                              {questionNum}
                            </span>
                          ))}
                          {flaggedQuestions.length > 20 && (
                            <span className="inline-flex items-center px-2 text-xs text-blue-700">
                              +{flaggedQuestions.length - 20} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Confirmation Checkbox */}
                <div className="rounded-lg border-2 border-gray-300 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="confirm-submission"
                      checked={confirmChecked}
                      onCheckedChange={(checked) => setConfirmChecked(checked === true)}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor="confirm-submission"
                      className="cursor-pointer text-sm leading-relaxed font-medium"
                    >
                      {t('confirmSubmissionCheckbox')}
                    </Label>
                  </div>
                </div>

                {!confirmChecked && <p className="text-xs text-gray-500">{t('confirmSubmissionHint')}</p>}
              </div>
            }
          />
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>{t('reviewQuestions')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!confirmChecked || isSubmitting}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
          >
            {isSubmitting ? t('submitting') : t('confirmAndSubmit')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
