'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import useSWR from 'swr';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { useContributorStatus } from '@/hooks/useContributorStatus';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { swrFetcher } from '@/services/utils/ts/requests';
import ExamResultsDashboard from './ExamResultsDashboard';
import ExamTakingInterface from './ExamTakingInterface';
import QuestionManagement from './QuestionManagement';
import { getAPIUrl } from '@/services/config/config';
import ExamPreScreen from './ExamPreScreen';
import ExamSettings from './ExamSettings';
import ExamResults from './ExamResults';

interface ExamActivityProps {
  activity: any;
  course: any;
  orgslug: string;
}

type ExamState = 'loading' | 'pre-exam' | 'taking' | 'results' | 'error' | 'manage';

export default function ExamActivity({ activity, course, orgslug }: ExamActivityProps) {
  const t = useTranslations('Activities.ExamActivity');
  const session = usePlatformSession();
  const accessToken = session?.data?.tokens?.access_token;
  const { contributorStatus } = useContributorStatus(course.course_uuid);

  const [currentAttempt, setCurrentAttempt] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('questions');
  const [overrideState, setOverrideState] = useState<ExamState | null>(null);

  const isTeacher = contributorStatus === 'ACTIVE';

  // Fetch exam data
  const {
    data: exam,
    error: examError,
    mutate: mutateExam,
  } = useSWR(accessToken ? `${getAPIUrl()}exams/activity/${activity.activity_uuid}` : null, (url) =>
    swrFetcher(url, accessToken),
  );

  // Safe exam uuid reference to avoid accessing property on undefined
  const examUuid = exam?.exam_uuid ?? null;


  // Fetch questions
  const {
    data: questions,
    error: questionsError,
    mutate: mutateQuestions,
  } = useSWR(examUuid && accessToken ? `${getAPIUrl()}exams/${examUuid}/questions` : null, (url) =>
    swrFetcher(url, accessToken),
  );

  // Fetch user's attempts (fetch for both students and teachers now)
  const {
    data: userAttempts,
    error: attemptsError,
    mutate: mutateAttempts,
  } = useSWR(
    examUuid && accessToken ? `${getAPIUrl()}exams/${examUuid}/attempts/me` : null,
    (url) => swrFetcher(url, accessToken),
  );

  // Fetch all attempts for teachers
  const { data: allAttempts } = useSWR(
    examUuid && accessToken && isTeacher ? `${getAPIUrl()}exams/${examUuid}/attempts/all` : null,
    (url) => swrFetcher(url, accessToken),
  );

  // Derive state from inputs to avoid setState-in-effect and setTimeout usage
  const derivedState = useMemo<ExamState>(() => {
    if (examError || questionsError || attemptsError) return 'error';
    if (!exam || !questions) return 'loading';

    // Teachers can see management view or take the exam
    if (isTeacher && !currentAttempt) return 'manage';

    if (!userAttempts) return 'pre-exam';

    const inProgressAttempt = userAttempts.find((a: any) => a.status === 'IN_PROGRESS');
    if (inProgressAttempt) return 'taking';

    const lastAttempt = userAttempts[0];
    if (lastAttempt && (lastAttempt.status === 'SUBMITTED' || lastAttempt.status === 'AUTO_SUBMITTED')) {
      const submittedAt = new Date(lastAttempt.submitted_at).getTime();
      if (Date.now() - submittedAt < 5 * 60 * 1000) return 'results';
    }

    return 'pre-exam';
  }, [exam, questions, userAttempts, examError, questionsError, attemptsError, isTeacher, currentAttempt]);

  const currentState = overrideState ?? derivedState;

  // Show a loading/error toast as needed
  useEffect(() => {
    if (examError || questionsError || (attemptsError && !isTeacher)) {
      toast.error(t('errorLoadingExam'));
    }
  }, [examError, questionsError, attemptsError, isTeacher, t]);

  // Clear manual override when derived state changes (but don't clear while loading)
  useEffect(() => {
    // Don't clear override when teacher intentionally switches to pre-exam or taking mode
    const isTeacherPreviewMode = isTeacher && (overrideState === 'pre-exam' || overrideState === 'taking');

    // If we're temporarily loading data, keep the manual override (prevents flicker back to loading)
    if (overrideState && overrideState !== derivedState && derivedState !== 'loading' && !isTeacherPreviewMode) {
      setOverrideState(null);
    }
  }, [overrideState, derivedState, isTeacher]);

  const handleStartExam = (attempt: any) => {
    setCurrentAttempt(attempt);
    setOverrideState('taking');
    // Ensure question list is fresh before rendering taking UI
    void mutateQuestions?.();
  };

  const handleCompleteExam = async () => {
    // Refresh attempts data
    await mutateAttempts();

    // Find the just-completed attempt
    const completedAttempt = await fetch(`${getAPIUrl()}exams/${examUuid}/attempts/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }).then((res) => res.json());

    const lastAttempt = completedAttempt[0];
    setCurrentAttempt(lastAttempt);
    setOverrideState('results');
  };

  const handleReturnToCourse = () => {
    const courseuuid = course.course_uuid?.replace('course_', '');
    window.location.href = `/course/${courseuuid}`;
  };

  if (currentState === 'loading' || !exam || !questions) {
    return <PageLoading />;
  }

  // Teacher management view
  if (currentState === 'manage' && isTeacher) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">{activity.name}</h1>
            <p className="text-muted-foreground">{t('manageExam')}</p>
          </div>
          <Button
            onClick={() => setOverrideState('pre-exam')}
            variant="outline"
          >
            {t('previewExam')}
          </Button>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="questions">{t('questions')}</TabsTrigger>
            <TabsTrigger value="settings">{t('settings')}</TabsTrigger>
            <TabsTrigger value="results">{t('results')}</TabsTrigger>
          </TabsList>

          <TabsContent
            value="questions"
            className="mt-6"
          >
            <QuestionManagement
              examUuid={examUuid}
              questions={questions}
              accessToken={accessToken!}
              onQuestionsChange={() => mutateQuestions()}
            />
          </TabsContent>

          <TabsContent
            value="settings"
            className="mt-6"
          >
            <ExamSettings
              exam={exam}
              courseId={course.id}
              accessToken={accessToken!}
              onSettingsUpdated={() => mutateExam()}
            />
          </TabsContent>

          <TabsContent
            value="results"
            className="mt-6"
          >
            {allAttempts && (
              <ExamResultsDashboard
                examUuid={examUuid}
                attempts={allAttempts}
                onViewAttempt={(attemptUuid) => {
                  // TODO: Navigate to attempt detail view
                  toast.info(t('viewAttempt', { attempt: attemptUuid }));
                }}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Student views
  if (currentState === 'pre-exam') {
    return (
      <ExamPreScreen
        exam={exam}
        questionCount={questions.length}
        userAttempts={userAttempts || []}
        accessToken={accessToken!}
        onStartExam={handleStartExam}
        isTeacher={isTeacher}
        onBackToManage={isTeacher ? () => setOverrideState(null) : undefined}
      />
    );
  }

  if (currentState === 'taking' && currentAttempt) {
    return (
      <ExamTakingInterface
        exam={exam}
        questions={questions}
        attempt={currentAttempt}
        accessToken={accessToken!}
        onComplete={handleCompleteExam}
      />
    );
  }

  const handleRetry = async () => {
    // Start a new attempt if allowed
    try {
      const response = await fetch(`${getAPIUrl()}exams/${exam.exam_uuid}/attempts/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({} as any));
        toast.error(error.detail || t('errorStartingExam'));
        return;
      }

      const attempt = await response.json();
      toast.success(t('examStarted'));
      handleStartExam(attempt);
    } catch (err) {
      console.error('Failed to start retry attempt:', err);
      toast.error(t('errorStartingExam'));
    }
  };

  const remainingAttempts = isTeacher ? null : (exam?.settings?.attempt_limit && exam.settings.attempt_limit > 0 ? exam.settings.attempt_limit - (userAttempts?.length || 0) : null);

  if (currentState === 'results' && currentAttempt) {
    return (
      <ExamResults
        exam={exam}
        attempt={currentAttempt}
        questions={questions}
        onReturnToCourse={handleReturnToCourse}
        onRetry={handleRetry}
        remainingAttempts={remainingAttempts}
        isTeacher={isTeacher}
      />
    );
  }

  return <PageLoading />;
}
