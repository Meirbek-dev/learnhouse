'use client';

import { useCallback, useEffect, useState, useEffectEvent, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { RadioGroup, RadioGroupItem } from '@components/ui/radio-group';
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
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
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

  const handleAutoSubmitEvent = useEffectEvent((reason: string) => {
    toast.error(t('autoSubmitting', { reason }));
    void handleSubmit(true);
  });

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

  // Initialize timer (uses effect event to call auto-submit safely)
  useEffect(() => {
    if (settings.time_limit && attempt.started_at) {
      const startTime = new Date(attempt.started_at).getTime();
      const endTime = startTime + settings.time_limit * 60 * 1000;

      const updateTimer = () => {
        const now = Date.now();
        const remaining = Math.max(0, endTime - now);
        setTimeRemaining(Math.floor(remaining / 1000));

        if (remaining <= 0) {
          handleAutoSubmitEvent('Time expired');
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [settings.time_limit, attempt.started_at]);

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
            className="space-y-3"
          >
            {question.answer_options.map((option, index) => (
              <div
                key={index}
                className="flex items-center space-x-2"
              >
                <RadioGroupItem
                  value={index.toString()}
                  id={`q${questionId}-${index}`}
                />
                <Label
                  htmlFor={`q${questionId}-${index}`}
                  className="cursor-pointer"
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
          <div className="space-y-3">
            {question.answer_options.map((option, index) => (
              <div
                key={index}
                className="flex items-center space-x-2"
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
                  className="cursor-pointer"
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
          <div className="space-y-4">
            {question.answer_options.map((option, index) => (
              <div
                key={index}
                className="flex items-center gap-4"
              >
                <span className="min-w-[200px] font-medium">{option.left}</span>
                <span>→</span>
                <select
                  value={matchAnswers[option.left || ''] || ''}
                  onChange={(e) => {
                    handleAnswerChange(questionId, {
                      ...matchAnswers,
                      [option.left || '']: e.target.value,
                    });
                  }}
                  className="flex-1 rounded-md border border-gray-300 p-2"
                >
                  <option value="">{t('selectMatch')}</option>
                  {question.answer_options.map((opt, idx) => (
                    <option
                      key={idx}
                      value={opt.right}
                    >
                      {opt.right}
                    </option>
                  ))}
                </select>
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
      className="mx-auto max-w-4xl space-y-6 p-6"
    >
      {/* Header with Timer and Progress */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{exam.title}</h2>
          <p className="text-sm text-gray-600">
            {t('questionProgress', {
              current: currentQuestionIndex + 1,
              total: orderedQuestions.length,
            })}
          </p>
        </div>
        {timeRemaining !== null && (
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <span className="text-lg font-semibold text-blue-900">{formatTime(timeRemaining)}</span>
          </div>
        )}
      </div>

      <Progress
        value={progress}
        className="h-2"
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

      {/* Question Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t('questionNumber', { number: currentQuestionIndex + 1 })}</span>
            <span className="text-sm font-normal text-gray-500">
              {t('points', { count: currentQuestion?.points ?? 0 })}
            </span>
          </CardTitle>
          <CardDescription className="text-base text-gray-900">{currentQuestion?.question_text}</CardDescription>
        </CardHeader>
        <CardContent>{currentQuestion && renderQuestion(currentQuestion)}</CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
          disabled={currentQuestionIndex === 0}
        >
          {t('previous')}
        </Button>

        <div className="text-sm text-gray-600">
          {t('answeredCount', { answered: answeredCount, total: orderedQuestions.length })}
        </div>

        {currentQuestionIndex < orderedQuestions.length - 1 ? (
          <Button onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}>{t('next')}</Button>
        ) : (
          <Button
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {isSubmitting ? t('submitting') : t('submitExam')}
          </Button>
        )}
      </div>

      {/* Question Navigator */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('questionNavigator')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-10 gap-2">
            {orderedQuestions.map((q, index) => (
              <button
                key={q.id}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`rounded p-2 text-sm font-medium transition ${
                  index === currentQuestionIndex
                    ? 'bg-blue-600 text-white'
                    : isAnswered(q.id)
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
