'use client';

import { AlertCircle, CheckCircle2, Trophy, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Progress } from '@components/ui/progress';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';

interface Question {
  id: number;
  question_text: string;
  question_type: string;
  answer_options: { text: string; is_correct?: boolean; left?: string; right?: string }[];
  explanation?: string;
  points: number;
}

interface ExamResultsProps {
  exam: any;
  attempt: any;
  questions: Question[];
  onReturnToCourse: () => void;
  onRetry?: () => void;
  remainingAttempts?: number | null;
  isTeacher?: boolean;
}

export default function ExamResults({
  exam,
  attempt,
  questions,
  onReturnToCourse,
  onRetry,
  remainingAttempts = null,
  isTeacher = false,
}: ExamResultsProps) {
  const t = useTranslations('Activities.ExamActivity');

  const settings = exam.settings || {};
  const showCorrectAnswers = settings.allow_result_review && settings.show_correct_answers;
  const allowReview = settings.allow_result_review;

  const percentage = attempt.max_score > 0 ? Math.round((attempt.score / attempt.max_score) * 100) : 0;

  const orderedQuestions = attempt.question_order
    .map((id: number) => questions.find((q) => q.id === id))
    .filter(Boolean) as Question[];

  const getAnswerStatus = (question: Question) => {
    const userAnswer = attempt.answers[question.id];
    if (userAnswer === undefined || userAnswer === null) return 'unanswered';

    switch (question.question_type) {
      case 'SINGLE_CHOICE':
      case 'TRUE_FALSE': {
        const correctIndices = question.answer_options
          .map((opt, idx) => (opt.is_correct ? idx : -1))
          .filter((idx) => idx !== -1);
        return correctIndices.includes(userAnswer) ? 'correct' : 'incorrect';
      }

      case 'MULTIPLE_CHOICE': {
        const correctIndices = new Set(
          question.answer_options.map((opt, idx) => (opt.is_correct ? idx : -1)).filter((idx) => idx !== -1),
        );
        const userIndices = new Set(userAnswer);
        const isCorrect =
          correctIndices.size === userIndices.size && [...correctIndices].every((idx) => userIndices.has(idx));
        return isCorrect ? 'correct' : 'incorrect';
      }

      case 'MATCHING': {
        const allCorrect = question.answer_options.every((opt) => userAnswer[opt.left || ''] === opt.right);
        return allCorrect ? 'correct' : 'incorrect';
      }

      default: {
        return 'unanswered';
      }
    }
  };

  const correctCount = orderedQuestions.filter((q) => getAnswerStatus(q) === 'correct').length;
  const incorrectCount = orderedQuestions.filter((q) => getAnswerStatus(q) === 'incorrect').length;
  const unansweredCount = orderedQuestions.filter((q) => getAnswerStatus(q) === 'unanswered').length;

  const renderUserAnswer = (question: Question) => {
    const userAnswer = attempt.answers[question.id];

    if (userAnswer === undefined || userAnswer === null) {
      return <span className="text-gray-500">{t('notAnswered')}</span>;
    }

    switch (question.question_type) {
      case 'SINGLE_CHOICE':
      case 'TRUE_FALSE': {
        return <span className="font-medium">{question.answer_options[userAnswer]?.text || t('invalidAnswer')}</span>;
      }

      case 'MULTIPLE_CHOICE': {
        return (
          <div className="space-y-1">
            {userAnswer.map((idx: number) => (
              <div key={idx}>{question.answer_options[idx]?.text}</div>
            ))}
          </div>
        );
      }

      case 'MATCHING': {
        return (
          <div className="space-y-1">
            {Object.entries(userAnswer).map(([left, right]) => (
              <div key={left}>
                {left} → {right as string}
              </div>
            ))}
          </div>
        );
      }

      default: {
        return null;
      }
    }
  };

  const renderCorrectAnswer = (question: Question) => {
    if (!showCorrectAnswers) return null;

    switch (question.question_type) {
      case 'SINGLE_CHOICE':
      case 'TRUE_FALSE':
      case 'MULTIPLE_CHOICE': {
        const correctOptions = question.answer_options.filter((opt) => opt.is_correct);
        return (
          <div className="space-y-1">
            {correctOptions.map((opt, idx) => (
              <div
                key={idx}
                className="text-green-700"
              >
                {opt.text}
              </div>
            ))}
          </div>
        );
      }

      case 'MATCHING': {
        return (
          <div className="space-y-1">
            {question.answer_options.map((opt, idx) => (
              <div
                key={idx}
                className="text-green-700"
              >
                {opt.left} → {opt.right}
              </div>
            ))}
          </div>
        );
      }

      default: {
        return null;
      }
    }
  };

  const handleExportCSV = () => {
    const headers = [t('question'), t('yourAnswer'), t('correctAnswer'), t('status'), t('points')];
    const rows = orderedQuestions.map((q) => {
      const status = getAnswerStatus(q);
      const your = renderUserAnswer(q);
      const correct = showCorrectAnswers ? (Array.isArray(renderCorrectAnswer(q)) ? renderCorrectAnswer(q) : '') : '';
      const yourText =
        typeof your === 'string' ? your : your === null ? '' : typeof your === 'object' ? JSON.stringify(your) : '';
      const correctText =
        typeof correct === 'string' ? correct : typeof correct === 'object' ? JSON.stringify(correct) : '';
      return [q.question_text.replace(/\n/g, ' '), yourText, correctText, status, String(q.points)];
    });

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exam.title}-results.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Score Card */}
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-blue-100">
            <Trophy className="h-12 w-12 text-blue-600" />
          </div>
          <CardTitle className="text-3xl">{t('examCompleted')}</CardTitle>
          <CardDescription className="text-base">{exam.title}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Score Display */}
          <div className="text-center">
            <div className="mb-2 text-6xl font-bold text-blue-600">{percentage}%</div>
            <div className="text-xl text-gray-600">
              {attempt.score} / {t('points', { count: attempt.max_score })}
            </div>
          </div>

          <Progress
            value={percentage}
            className="h-3"
          />

          {/* Statistics */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">{t('correct')}</p>
                <p className="text-2xl font-bold text-green-600">{correctCount}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <XCircle className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">{t('incorrect')}</p>
                <p className="text-2xl font-bold text-red-600">{incorrectCount}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <AlertCircle className="h-8 w-8 text-gray-600" />
              <div>
                <p className="text-sm text-gray-600">{t('unanswered')}</p>
                <p className="text-2xl font-bold text-gray-600">{unansweredCount}</p>
              </div>
            </div>
          </div>

          {/* Violations */}
          {attempt.violations && attempt.violations.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="font-semibold text-amber-900">
                {t('violationsRecorded', { count: attempt.violations.length })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Answer Review */}
      {allowReview && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">{t('answerReview')}</h2>

          {orderedQuestions.map((question, index) => {
            const status = getAnswerStatus(question);

            return (
              <Card key={question.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{t('questionNumber', { number: index + 1 })}</CardTitle>
                    <Badge
                      variant={status === 'correct' ? 'default' : status === 'incorrect' ? 'destructive' : 'secondary'}
                      className={
                        status === 'correct' ? 'bg-green-600' : status === 'incorrect' ? 'bg-red-600' : 'bg-gray-400'
                      }
                    >
                      {status === 'correct' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                      {status === 'incorrect' && <XCircle className="mr-1 h-3 w-3" />}
                      {status === 'unanswered' && <AlertCircle className="mr-1 h-3 w-3" />}
                      {t(status)}
                    </Badge>
                  </div>
                  <CardDescription className="text-base text-gray-900">{question.question_text}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-semibold text-gray-600">{t('yourAnswer')}</p>
                    <div className="rounded-lg bg-gray-50 p-3">{renderUserAnswer(question)}</div>
                  </div>

                  {showCorrectAnswers && status !== 'correct' && (
                    <div>
                      <p className="mb-2 text-sm font-semibold text-green-600">{t('correctAnswer')}</p>
                      <div className="rounded-lg bg-green-50 p-3">{renderCorrectAnswer(question)}</div>
                    </div>
                  )}

                  {question.explanation && status !== 'correct' && (
                    <div className="rounded-lg border-l-4 border-blue-500 bg-blue-50 p-3">
                      <p className="text-sm font-semibold text-blue-900">{t('explanation')}</p>
                      <p className="text-sm text-blue-800">{question.explanation}</p>
                    </div>
                  )}

                  <div className="text-sm text-gray-600">{t('pointsValue', { points: question.points })}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-center space-x-4">
        <Button
          size="lg"
          variant="outline"
          onClick={handleExportCSV}
        >
          {t('downloadCsv')}
        </Button>

        {onRetry && (
          <Button
            size="lg"
            variant="outline"
            onClick={onRetry}
            disabled={!isTeacher && remainingAttempts !== null && remainingAttempts <= 0}
            aria-disabled={!isTeacher && remainingAttempts !== null && remainingAttempts <= 0}
            title={
              !isTeacher && remainingAttempts !== null && remainingAttempts <= 0 ? t('noAttemptsRemaining') : undefined
            }
          >
            {remainingAttempts !== null && remainingAttempts !== undefined
              ? t('retryExamRemaining', { remaining: remainingAttempts })
              : t('retryExam')}
          </Button>
        )}

        <Button
          size="lg"
          onClick={onReturnToCourse}
        >
          {t('returnToCourse')}
        </Button>
      </div>
    </div>
  );
}
