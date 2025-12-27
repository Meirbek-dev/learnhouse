'use client';

import { AlertCircle, CheckCircle, Clock, FileText, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import { getAPIUrl } from '@/services/config/config';
import { Button } from '@components/ui/button';

interface ExamPreScreenProps {
  exam: any;
  questionCount: number;
  userAttempts: any[];
  accessToken: string;
  onStartExam: (attempt: any) => void;
  isTeacher?: boolean;
  onBackToManage?: () => void;
}

export default function ExamPreScreen({
  exam,
  questionCount,
  userAttempts,
  accessToken,
  onStartExam,
  isTeacher = false,
  onBackToManage,
}: ExamPreScreenProps) {
  const t = useTranslations('Activities.ExamActivity');
  const [isStarting, setIsStarting] = useState(false);

  const settings = exam.settings || {};
  const attemptLimit = settings.attempt_limit;
  const timeLimit = settings.time_limit;
  const remainingAttempts = isTeacher ? null : (attemptLimit && attemptLimit > 0 ? attemptLimit - userAttempts.length : null);

  // Teachers can always take exams (unlimited attempts for preview/testing)
  const canTakeExam = isTeacher || !attemptLimit || attemptLimit === 0 || userAttempts.length < attemptLimit;

  const handleStartExam = async () => {
    if (!canTakeExam) {
      toast.error(t('noAttemptsRemaining'));
      return;
    }

    setIsStarting(true);

    try {
      const response = await fetch(`${getAPIUrl()}exams/${exam.exam_uuid}/attempts/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to start exam');
      }

      const attempt = await response.json();
      toast.success(t('examStarted'));
      onStartExam(attempt);
    } catch (error: any) {
      console.error('Error starting exam:', error);
      toast.error(error.message || t('errorStartingExam'));
      setIsStarting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">{exam.title}</CardTitle>
          <CardDescription className="text-base">{exam.description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Exam Information */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <FileText className="mt-1 h-5 w-5 text-blue-600" />
              <div>
                <p className="font-semibold">{t('totalQuestions')}</p>
                <p className="text-2xl font-bold text-blue-600">{questionCount}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border p-4">
              <Clock className="mt-1 h-5 w-5 text-orange-600" />
              <div>
                <p className="font-semibold">{t('timeLimit')}</p>
                <p className="text-2xl font-bold text-orange-600">
                  {timeLimit ? t('minutes', { count: timeLimit }) : t('unlimited')}
                </p>
              </div>
            </div>

            {attemptLimit && attemptLimit > 0 && !isTeacher && (
              <div className="flex items-start gap-3 rounded-lg border p-4">
                <Users className="mt-1 h-5 w-5 text-purple-600" />
                <div>
                  <p className="font-semibold">{t('attemptsRemaining')}</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {remainingAttempts !== null ? remainingAttempts : t('unlimited')}
                  </p>
                </div>
              </div>
            )}

            {isTeacher && (
              <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <Users className="mt-1 h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold text-blue-900">{t('teacherPreview')}</p>
                  <p className="text-sm text-blue-700">{t('unlimitedAttempts')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('instructions')}</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                <span>{t('instruction1')}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                <span>{t('instruction2')}</span>
              </li>
              {timeLimit && (
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>{t('instruction3', { minutes: timeLimit })}</span>
                </li>
              )}
              {settings.tab_switch_detection && (
                <li className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                  <span>{t('instruction4')}</span>
                </li>
              )}
              {settings.copy_paste_protection && (
                <li className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                  <span>{t('instruction5')}</span>
                </li>
              )}
            </ul>
          </div>

          {/* Anti-Cheating Warnings */}
          {(settings.tab_switch_detection || settings.copy_paste_protection || settings.devtools_detection) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('antiCheatingEnabled')}</AlertTitle>
              <AlertDescription>
                {t('antiCheatingDescription', {
                  threshold: settings.violation_threshold || t('notSet'),
                })}
              </AlertDescription>
            </Alert>
          )}

          {/* Previous Attempts */}
          {userAttempts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">{t('previousAttempts')}</h3>
              <div className="space-y-2">
                {userAttempts.map((attempt, index) => (
                  <div
                    key={attempt.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{t('attemptNumber', { number: index + 1 })}</p>
                      <p className="text-sm text-gray-600">{new Date(attempt.submitted_at).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        {attempt.score}/{attempt.max_score}
                      </p>
                      <p className="text-sm text-gray-600">{Math.round((attempt.score / attempt.max_score) * 100)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Start Button */}
          <div className="flex justify-center gap-3 pt-4">
            {isTeacher && onBackToManage && (
              <Button
                size="lg"
                onClick={onBackToManage}
                variant="outline"
              >
                {t('backToManagement')}
              </Button>
            )}
            {canTakeExam ? (
              <Button
                size="lg"
                onClick={handleStartExam}
                disabled={isStarting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isStarting ? t('starting') : t('startExam')}
              </Button>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{t('noAttemptsRemaining')}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
