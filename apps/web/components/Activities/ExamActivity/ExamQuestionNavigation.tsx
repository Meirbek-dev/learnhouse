'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, Flag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface ExamQuestionNavigationProps {
  totalQuestions: number;
  currentQuestionIndex: number;
  answeredQuestions: Set<number>;
  flaggedQuestions?: Set<number>;
  onQuestionSelect: (index: number) => void;
  className?: string;
}

export default function ExamQuestionNavigation({
  totalQuestions,
  currentQuestionIndex,
  answeredQuestions,
  flaggedQuestions = new Set(),
  onQuestionSelect,
  className,
}: ExamQuestionNavigationProps) {
  const t = useTranslations('Activities.ExamActivity');

  const answeredCount = answeredQuestions.size;
  const flaggedCount = flaggedQuestions.size;
  const progress = (answeredCount / totalQuestions) * 100;

  return (
    <Card className={cn('lg:sticky lg:top-6', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('questionNavigator')}</CardTitle>
        <CardDescription className="text-xs">
          {t('questionNavigatorDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Summary */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{t('progress')}</span>
            <span className="font-semibold">
              {answeredCount}/{totalQuestions}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Question Grid */}
        <div className="grid grid-cols-5 gap-2 md:grid-cols-8 lg:grid-cols-5">
          {Array.from({ length: totalQuestions }, (_, index) => {
            const questionNumber = index + 1;
            const isAnswered = answeredQuestions.has(index);
            const isCurrent = index === currentQuestionIndex;
            const isFlagged = flaggedQuestions.has(index);

            let bgColor = 'bg-gray-100 hover:bg-gray-200 border-gray-200';
            let textColor = 'text-gray-600';
            let borderColor = '';

            if (isCurrent) {
              bgColor = 'bg-blue-500 hover:bg-blue-600 border-blue-600';
              textColor = 'text-white';
            } else if (isAnswered) {
              bgColor = 'bg-green-100 hover:bg-green-200 border-green-300';
              textColor = 'text-green-700';
            }

            if (isFlagged && !isCurrent) {
              borderColor = 'ring-2 ring-orange-400 ring-offset-1';
            }

            return (
              <button
                key={index}
                onClick={() => onQuestionSelect(index)}
                className={cn(
                  'relative flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium transition-all',
                  bgColor,
                  textColor,
                  borderColor,
                )}
                aria-label={t('questionAriaLabel', {
                  number: questionNumber,
                  answered: isAnswered ? 'true' : 'false',
                })}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {questionNumber}
                {isFlagged && (
                  <Flag
                    className={cn(
                      'absolute -right-1 -top-1 h-3 w-3',
                      isCurrent ? 'text-orange-300' : 'text-orange-500',
                    )}
                    fill="currentColor"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="space-y-2 border-t pt-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-green-100">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
            <span className="text-gray-600">
              {t('answered')} ({answeredCount})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-500">
              <Circle className="h-4 w-4 text-white" />
            </div>
            <span className="text-gray-600">{t('current')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-gray-100">
              <Circle className="h-4 w-4 text-gray-400" />
            </div>
            <span className="text-gray-600">
              {t('unanswered')} ({totalQuestions - answeredCount})
            </span>
          </div>
          {flaggedCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded border-2 border-orange-400">
                <Flag className="h-3 w-3 text-orange-500" fill="currentColor" />
              </div>
              <span className="text-gray-600">
                {t('flagged')} ({flaggedCount})
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Mobile bottom navigation variant
 */
export function ExamQuestionNavigationMobile({
  totalQuestions,
  currentQuestionIndex,
  answeredQuestions,
  flaggedQuestions = new Set(),
  onQuestionSelect,
  onPrevious,
  onNext,
  onSubmit,
  canGoNext,
  canGoPrevious,
}: ExamQuestionNavigationProps & {
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
}) {
  const t = useTranslations('Activities.ExamActivity');
  const answeredCount = answeredQuestions.size;
  const progress = (answeredCount / totalQuestions) * 100;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  return (
    <div className="fixed right-0 bottom-0 left-0 z-50 border-t bg-white shadow-lg lg:hidden">
      <div className="px-4 py-3">
        {/* Progress bar */}
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
            <span>
              {t('questionProgress', {
                current: currentQuestionIndex + 1,
                total: totalQuestions,
              })}
            </span>
            <span>
              {answeredCount}/{totalQuestions}
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrevious}
            disabled={!canGoPrevious}
            className="flex-1"
          >
            {t('previous')}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="min-w-[60px]"
            onClick={() => {
              // Could open a drawer with full question grid
            }}
          >
            <span className="text-xs">
              {currentQuestionIndex + 1}/{totalQuestions}
            </span>
          </Button>

          {isLastQuestion ? (
            <Button
              size="sm"
              onClick={onSubmit}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="mr-1 h-4 w-4" />
              {t('submitExam')}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onNext}
              disabled={!canGoNext}
              className="flex-1"
            >
              {t('next')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
