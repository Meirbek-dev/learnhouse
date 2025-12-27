'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import ExamTimer from './ExamTimer';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { RadioGroup, RadioGroupItem } from '@components/ui/radio-group';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@components/ui/select';
import { Alert, AlertDescription } from '@components/ui/alert';
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
import { getAPIUrl } from '@/services/config/config';
import { useTestGuard } from '@/hooks/useTestGuard';
import { Progress } from '@components/ui/progress';
import { Checkbox } from '@components/ui/checkbox';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';

interface Question {
  id: number;
  question_uuid: string;
  question_text: string;
  question_type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MATCHING';
  points: number;
  explanation?: string;
  answer_options: { text: string; is_correct?: boolean; left?: string; right?: string }[];
}

interface ExamAttempt {
  id: number;
  attempt_uuid: string;
  exam_id: number;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'AUTO_SUBMITTED';
  question_order: number[];
  started_at: string;
  violations: { type: string; timestamp: string }[];
}

interface ExamTakingInterfaceProps {
  exam: any;
  questions: Question[];
  attempt: ExamAttempt;
  accessToken: string;
  onComplete: () => void;
}

export default function ExamTakingInterface({
  exam,
  questions,
  attempt,
  accessToken,
  onComplete,
}: ExamTakingInterfaceProps) {
  const t = useTranslations('Activities.ExamActivity');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [violationDialogOpen, setViolationDialogOpen] = useState(false);
  const [currentViolation, setCurrentViolation] = useState<{ type: string; count: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const examContainerRef = useRef<HTMLDivElement>(null);

  const settings = exam.settings || {};
  const orderedQuestions = attempt.question_order
    .map((id) => questions.find((q) => q.id === id))
    .filter(Boolean) as Question[];

  const currentQuestion = orderedQuestions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / orderedQuestions.length) * 100;

  const handleSubmit = useCallback(
    async (isAutoSubmit = false) => {
      if (isSubmitting) return;
      setIsSubmitting(true);

      try {
        const response = await fetch(`${getAPIUrl()}exams/${exam.exam_uuid}/attempts/${attempt.attempt_uuid}/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify(answers),
        });

        if (!response.ok) {
          throw new Error('Failed to submit exam');
        }

        toast.success(t('examSubmittedSuccessfully'));
        onComplete();
      } catch (error) {
        console.error('Error submitting exam:', error);
        toast.error(t('errorSubmittingExam'));
        setIsSubmitting(false);
      }
    },
    [isSubmitting, answers, accessToken, exam.exam_uuid, attempt.attempt_uuid, onComplete, t],
  );


  // Anti-cheating with useTestGuard
  const handleViolation = useCallback(
    async (type: string, count: number) => {
      setViolationCount(count);
      setCurrentViolation({ type, count });
      setViolationDialogOpen(true);

      // Record violation on server
      try {
        await fetch(`${getAPIUrl()}exams/${exam.exam_uuid}/attempts/${attempt.attempt_uuid}/violations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ type }),
        });

        // Check if threshold reached
        const threshold = settings.violation_threshold;
        if (threshold && count >= threshold) {
          // Close dialog (we will auto-submit immediately)
          setViolationDialogOpen(false);
          toast.error(t('autoSubmitting', { reason: 'Violation threshold exceeded' }));
          void handleSubmit(true);
        }
      } catch (error) {
        console.error('Failed to record violation:', error);
      }
    },
    [exam.exam_uuid, attempt.attempt_uuid, accessToken, settings.violation_threshold, t, handleSubmit],
  );

  useTestGuard({
    enabled: true,
    preventCopy: settings.copy_paste_protection,
    preventRightClick: settings.right_click_disable,
    trackBlur: settings.tab_switch_detection,
    trackDevTools: settings.devtools_detection,
    maxViolations: settings.violation_threshold || 999,
    onViolation: handleViolation,
  });



  // Fullscreen enforcement
  useEffect(() => {
    if (!settings.fullscreen_enforcement) return;

    const requestFullscreen = async () => {
      try {
        if (examContainerRef.current && !document.fullscreenElement) {
          await examContainerRef.current.requestFullscreen();
          setIsFullscreen(true);
        }
      } catch (error) {
        console.warn('Fullscreen request failed:', error);
        toast.warning(t('fullscreenNotSupported'));
      }
    };

    const handleFullscreenChange = async () => {
      const inFullscreen = !!document.fullscreenElement;
      setIsFullscreen(inFullscreen);

      if (!inFullscreen && settings.fullscreen_enforcement) {
        toast.warning(t('fullscreenExited'));
        await handleViolation('FULLSCREEN_EXIT', violationCount + 1);
      }
    };

    void requestFullscreen();
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      }
    };
  }, [settings.fullscreen_enforcement, handleViolation, t, violationCount]);

  const handleAnswerChange = (questionId: number, answer: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };



  const renderQuestion = (question: Question) => {
    const questionId = question.id;

    switch (question.question_type) {
      case 'SINGLE_CHOICE':
      case 'TRUE_FALSE': {
        return (
          <RadioGroup
            value={answers[questionId]?.toString()}
            onValueChange={(value) =>
              handleAnswerChange(questionId, typeof value === 'string' ? parseInt(value, 10) : Number(value))
            }
            className="space-y-2"
            aria-labelledby={`question-title-${questionId}`}
          >
            {question.answer_options.map((option, index) => (
              <div
                key={index}
                className="flex items-center space-x-3 rounded-lg border border-gray-200 p-4 transition-colors hover:border-gray-300 hover:bg-gray-50"
              >
                <RadioGroupItem
                  value={index.toString()}
                  id={`q${questionId}-${index}`}
                />
                <Label
                  htmlFor={`q${questionId}-${index}`}
                  className="flex-1 cursor-pointer text-base leading-relaxed"
                >
                  {option.text}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );
      }

      case 'MULTIPLE_CHOICE': {
        const selectedAnswers = answers[questionId] || [];
        return (
          <div className="space-y-2" role="group" aria-labelledby={`question-title-${questionId}`}>
            {question.answer_options.map((option, index) => (
              <div
                key={index}
                className="flex items-center space-x-3 rounded-lg border border-gray-200 p-4 transition-colors hover:border-gray-300 hover:bg-gray-50"
              >
                <Checkbox
                  id={`q${questionId}-${index}`}
                  checked={selectedAnswers.includes(index)}
                  onCheckedChange={(checked) => {
                    const newAnswers = checked
                      ? [...selectedAnswers, index]
                      : selectedAnswers.filter((i: number) => i !== index);
                    handleAnswerChange(questionId, newAnswers);
                  }}
                />
                <Label
                  htmlFor={`q${questionId}-${index}`}
                  className="flex-1 cursor-pointer text-base leading-relaxed"
                >
                  {option.text}
                </Label>
              </div>
            ))}
          </div>
        );
      }

      case 'MATCHING': {
        const matchAnswers = answers[questionId] || {};
        return (
          <div className="space-y-3">
            {question.answer_options.map((option, index) => (
              <div
                key={index}
                className="flex items-center gap-4 rounded-lg border border-gray-200 p-4"
              >
                <span className="min-w-[200px] text-base font-medium">{option.left}</span>
                <span className="text-gray-400">→</span>
                <div className="flex-1">
                  <Select
                    value={matchAnswers[option.left || ''] || ''}
                    onValueChange={(val) =>
                      handleAnswerChange(questionId, {
                        ...matchAnswers,
                        [option.left || '']: val,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('selectMatch')} />
                    </SelectTrigger>
                    <SelectContent>
                      {question.answer_options.map((opt, idx) => (
                        <SelectItem key={idx} value={opt.right ?? ''}>
                          {opt.right}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        );
      }

      default: {
        return <p>{t('unsupportedQuestionType')}</p>;
      }
    }
  };

  const isAnswered = (questionId: number) => {
    const answer = answers[questionId];
    if (answer === undefined || answer === null) return false;
    if (Array.isArray(answer)) return answer.length > 0;
    if (typeof answer === 'object') return Object.keys(answer).length > 0;
    return true;
  };

  const answeredCount = orderedQuestions.filter((q) => isAnswered(q.id)).length;

  return (
    <div
      ref={examContainerRef}
      className="mx-auto max-w-full space-y-6 p-4 md:p-6"
    >
      {/* Header with Timer and Progress */}
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 id={`exam-title-${attempt.attempt_uuid}`} className="text-xl font-bold md:text-2xl">{exam.title}</h2>
          <p className="text-sm text-gray-600">
            {t('questionProgress', {
              current: currentQuestionIndex + 1,
              total: orderedQuestions.length,
            })}
          </p>
        </div>
        {settings.time_limit && attempt.started_at && (
          <ExamTimer
            startedAt={attempt.started_at}
            timeLimitMinutes={settings.time_limit}
            onExpire={() => {
              toast.error(t('autoSubmitting', { reason: 'Time expired' }));
              void handleSubmit(true);
            }}
          />
        )}
      </div>

      <Progress
        value={progress}
        className="h-2 transition-all duration-500 ease-out"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('questionProgress', { current: currentQuestionIndex + 1, total: orderedQuestions.length })}
      />

      {/* Violation Warning */}
      {violationCount > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {t('violationWarning', {
              count: violationCount,
              max: settings.violation_threshold || t('unlimited'),
            })}
          </AlertDescription>
        </Alert>
      )}

      {/* Violation Dialog */}
      <AlertDialog open={violationDialogOpen} onOpenChange={setViolationDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <AlertTriangle className="text-destructive size-6" />
            </AlertDialogMedia>
            <AlertDialogTitle>{t('violationDialogTitle', { type: currentViolation?.type ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('violationDialogDescription', {
                type: currentViolation?.type ?? '',
                count: currentViolation?.count ?? 0,
                max: settings.violation_threshold || t('unlimited'),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel />
            <AlertDialogAction onClick={() => setViolationDialogOpen(false)}>
              {t('violationDialogAcknowledge')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Main Layout with Sidebar */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Question Card */}
          <Card role="group" aria-labelledby={`question-title-${currentQuestion?.id}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span id={`question-title-${currentQuestion?.id}`}>{t('questionNumber', { number: currentQuestionIndex + 1 })}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-normal text-gray-500">
                    {t('points', { count: currentQuestion?.points ?? 0 })}
                  </span>
                </div>
              </CardTitle>
              <CardDescription className="mt-4 text-lg leading-relaxed text-gray-900">
                {currentQuestion?.question_text}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">{currentQuestion && renderQuestion(currentQuestion)}</CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentQuestionIndex === 0}
              className="w-full md:w-auto"
            >
              {t('previous')}
            </Button>

            <div className="text-sm text-gray-600">
              {t('answeredCount', { answered: answeredCount, total: orderedQuestions.length })}
            </div>

            {currentQuestionIndex < orderedQuestions.length - 1 ? (
              <Button
                onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                className="w-full md:w-auto"
              >
                {t('next')}
              </Button>
            ) : (
              <Button
                onClick={() => setShowConfirmation(true)}
                disabled={isSubmitting}
                className="w-full bg-green-600 hover:bg-green-700 md:w-auto"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {t('reviewAndSubmit')}
              </Button>
            )}
          </div>
        </div>

        {/* Question Navigation Sidebar */}
        <div className="order-first lg:order-last">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-base">{t('questions')}</CardTitle>
              <CardDescription className="text-xs">
                {t('questionNavigatorDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2 md:grid-cols-8 lg:grid-cols-5">
                {orderedQuestions.map((question, index) => {
                  const answered = isAnswered(question.id);
                  const current = index === currentQuestionIndex;

                  let bgColor = 'bg-gray-100 hover:bg-gray-200';
                  let textColor = 'text-gray-600';

                  if (current) {
                    bgColor = 'bg-blue-500 hover:bg-blue-600';
                    textColor = 'text-white';
                  } else if (answered) {
                    bgColor = 'bg-green-100 hover:bg-green-200';
                    textColor = 'text-green-700';
                  }

                  return (
                    <button
                      key={question.id}
                      onClick={() => setCurrentQuestionIndex(index)}
                      className={`relative flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition-colors ${bgColor} ${textColor}`}
                      aria-label={t('questionAriaLabel', { number: index + 1, answered: answered ? 'true' : 'false' })}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 space-y-2 border-t pt-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-green-100"></div>
                  <span className="text-gray-600">{t('answered')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-blue-500"></div>
                  <span className="text-gray-600">{t('current')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-gray-100"></div>
                  <span className="text-gray-600">{t('unanswered')}</span>
                </div>

              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <CheckCircle2 className="size-6 text-green-600" />
            </AlertDialogMedia>
            <AlertDialogTitle>{t('confirmSubmission')}</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-3">
                <p>{t('confirmSubmissionMessage')}</p>
                <div className="rounded-lg border bg-gray-50 p-4">
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('totalQuestions')}:</span>
                      <span className="font-semibold">{orderedQuestions.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-600">{t('answered')}:</span>
                      <span className="font-semibold text-green-600">{answeredCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('unanswered')}:</span>
                      <span className="font-semibold">{orderedQuestions.length - answeredCount}</span>
                    </div>

                  </div>
                </div>
                {answeredCount < orderedQuestions.length && (
                  <p className="text-sm text-orange-600">
                    ⚠️ {t('unansweredQuestionsWarning', { count: orderedQuestions.length - answeredCount })}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>{t('reviewQuestions')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? t('submitting') : t('confirmAndSubmit')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
