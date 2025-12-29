'use client';

import { useCallback, useEffect, useReducer, useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR, { mutate } from 'swr';
import { toast } from 'sonner';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { useContributorStatus } from '@/hooks/useContributorStatus';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import type { AttemptData } from './state/examFlowReducer';
import { swrFetcher } from '@/services/utils/ts/requests';
import { examFlowReducer } from './state/examFlowReducer';
import ExamResultsDashboard from './ExamResultsDashboard';
import ExamTakingInterface from './ExamTakingInterface';
import QuestionManagement from './QuestionManagement';
import { getAPIUrl } from '@/services/config/config';
import { getTrailSwrKey } from '@services/courses/keys';
import { examActions } from './state/examActions';
import { Button } from '@/components/ui/button';
import ExamPreScreen from './ExamPreScreen';
import ExamSettings from './ExamSettings';
import ExamResults from './ExamResults';
import ExamLayout from './ExamLayout';

interface ExamActivityProps {
  activity: any;
  course: any;
  orgslug: string;
}

export default function ExamActivity({ activity, course, orgslug }: ExamActivityProps) {
  const t = useTranslations('Activities.ExamActivity');
  const session = usePlatformSession();
  const accessToken = session?.data?.tokens?.access_token;
  const { contributorStatus } = useContributorStatus(course.course_uuid);

  // Centralized state management with reducer
  const [state, dispatch] = useReducer(examFlowReducer, { phase: 'loading' });
  const [activeTab, setActiveTab] = useState('questions');

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
  } = useSWR(examUuid && accessToken ? `${getAPIUrl()}exams/${examUuid}/attempts/me` : null, (url) =>
    swrFetcher(url, accessToken),
  );

  // Fetch all attempts for teachers
  const { data: allAttempts } = useSWR(
    examUuid && accessToken && isTeacher ? `${getAPIUrl()}exams/${examUuid}/attempts/all` : null,
    (url) => swrFetcher(url, accessToken),
  );

  // Update state based on loaded data
  useEffect(() => {
    if (examError || questionsError || attemptsError) {
      dispatch(examActions.setError({ message: t('errorLoadingExam'), retryable: true }));
      toast.error(t('errorLoadingExam'));
      return;
    }

    if (!exam || !questions) {
      dispatch(examActions.setLoading());
      return;
    }

    const userAttemptsList = userAttempts || [];

    // Check for in-progress attempt
    const inProgressAttempt = userAttemptsList.find((a: AttemptData) => a.status === 'IN_PROGRESS');
    if (inProgressAttempt && state.phase !== 'taking') {
      dispatch(examActions.startExam(inProgressAttempt));
      return;
    }

    // If teacher and no active attempt, show management
    if (isTeacher && state.phase === 'loading') {
      dispatch(examActions.setPreExam(exam, questions, userAttemptsList));
      dispatch(examActions.enterManagementMode());
      return;
    }

    // Default to pre-exam if we're not in a specific state
    if (state.phase === 'loading') {
      dispatch(examActions.setPreExam(exam, questions, userAttemptsList));
    }
  }, [exam, questions, userAttempts, examError, questionsError, attemptsError, isTeacher, t, state.phase]);

  const handleStartExam = useCallback(
    (attempt: AttemptData) => {
      dispatch(examActions.startExam(attempt));
      void mutateQuestions?.();
    },
    [mutateQuestions],
  );

  const handleCompleteExam = useCallback(async () => {
    // Refresh attempts data
    await mutateAttempts();

    // Revalidate trail data
    try {
      await mutate([getTrailSwrKey(exam?.org_id), accessToken]);
    } catch (error) {
      console.warn('Failed to revalidate trail after exam completion', error);
    }

    // Revalidate course meta
    try {
      const withUnpublishedActivities = course?.withUnpublishedActivities || false;
      await mutate(
        `${getAPIUrl()}courses/${course?.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
      );
    } catch (error) {
      console.warn('Failed to revalidate course meta after exam completion', error);
    }

    // Fetch the completed attempt
    const completedAttempt = await fetch(`${getAPIUrl()}exams/${examUuid}/attempts/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then((res) => res.json());

    const lastAttempt = completedAttempt[0];
    dispatch(examActions.submitExam(lastAttempt));
  }, [mutateAttempts, exam, course, examUuid, accessToken]);

  const handleReturnToCourse = useCallback(() => {
    const courseuuid = course.course_uuid?.replace('course_', '');
    window.location.href = `/course/${courseuuid}`;
  }, [course]);

  const handleBackToPreExam = useCallback(() => {
    if (state.phase === 'results' || state.phase === 'manage') {
      dispatch(examActions.backToPreExam(userAttempts || []));
    }
  }, [state.phase, userAttempts]);

  if (state.phase === 'loading' || !exam || !questions) {
    return <PageLoading />;
  }

  // Error state
  if (state.phase === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">{t('errorLoadingExam')}</p>
          <Button
            onClick={() => dispatch(examActions.retry())}
            className="mt-4"
          >
            {t('tryAgain')}
          </Button>
        </div>
      </div>
    );
  }

  // Teacher management view
  if (state.phase === 'manage' && isTeacher) {
    const totalQuestions = state.questions?.length ?? 0;
    const totalAttempts = allAttempts?.length ?? 0;
    const avgScore =
      allAttempts && allAttempts.length > 0
        ? Math.round(allAttempts.reduce((s: number, a: any) => s + (a.percentage || 0), 0) / allAttempts.length)
        : 0;

    return (
      <ExamLayout title={activity.name}>
        <div className="space-y-6 p-0">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">{activity.name}</h1>
              <p className="text-muted-foreground">{t('manageExam')}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setActiveTab('questions')}
                variant="outline"
              >
                {t('manageQuestions')}
              </Button>
              <Button
                onClick={() => dispatch(examActions.exitManagementMode(userAttempts || []))}
                className="bg-green-600 hover:bg-green-700"
              >
                {t('previewExam')}
              </Button>
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(value) => value && setActiveTab(value)}
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
                    toast.info(t('viewAttempt', { attempt: attemptUuid }));
                  }}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </ExamLayout>
    );
  }

  // Student views
  if (state.phase === 'pre-exam') {
    return (
      <ExamLayout
        title={state.exam.title}
        startedAt={undefined}
        timeLimitMinutes={state.exam.settings?.time_limit ?? null}
      >
        <ExamPreScreen
          exam={state.exam}
          questionCount={state.questions.length}
          userAttempts={state.userAttempts}
          accessToken={accessToken!}
          onStartExam={handleStartExam}
          isTeacher={isTeacher}
          onBackToManage={isTeacher ? () => dispatch(examActions.enterManagementMode()) : undefined}
        />
      </ExamLayout>
    );
  }

  if (state.phase === 'taking') {
    return (
      <ExamLayout
        title={state.exam.title}
        startedAt={state.attempt?.started_at}
        timeLimitMinutes={state.exam.settings?.time_limit ?? null}
      >
        <ExamTakingInterface
          exam={state.exam}
          questions={state.questions}
          attempt={state.attempt}
          accessToken={accessToken!}
          onComplete={handleCompleteExam}
        />
      </ExamLayout>
    );
  }

  const handleRetry = async () => {
    // Start a new attempt if allowed
    try {
      const response = await fetch(`${getAPIUrl()}exams/${exam.exam_uuid}/attempts/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}) as any);
        toast.error(error.detail || t('errorStartingExam'));
        return;
      }

      const attempt = await response.json();
      toast.success(t('examStarted'));
      handleStartExam(attempt);
    } catch (error) {
      console.error('Failed to start retry attempt:', error);
      toast.error(t('errorStartingExam'));
    }
  };

  if (state.phase === 'results') {
    const attempts = userAttempts || [];
    const remainingAttempts =
      isTeacher || !state.exam?.settings?.attempt_limit || state.exam.settings.attempt_limit === 0
        ? null
        : state.exam.settings.attempt_limit - attempts.length;

    return (
      <ExamLayout
        title={state.exam.title}
        startedAt={state.attempt?.started_at ?? undefined}
        timeLimitMinutes={state.exam.settings?.time_limit ?? null}
      >
        <ExamResults
          exam={state.exam}
          attempt={state.attempt}
          questions={state.questions}
          onReturnToCourse={handleReturnToCourse}
          onRetry={handleRetry}
          remainingAttempts={remainingAttempts}
          isTeacher={isTeacher}
        />
      </ExamLayout>
    );
  }

  return <PageLoading />;
}
