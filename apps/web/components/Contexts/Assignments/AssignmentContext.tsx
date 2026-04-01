'use client';

import { usePlatformSession } from '@/components/Contexts/SessionContext';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import ErrorUI from '@/components/Objects/Elements/Error/Error';
import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { createContext, use, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import useSWR from 'swr';

interface AssignmentContextType {
  assignment_object: any | null;
  assignment_tasks: any[] | null;
  course_object: any | null;
  activity_object: any | null;
}

export const AssignmentContext = createContext<AssignmentContextType>({
  assignment_object: null,
  assignment_tasks: null,
  course_object: null,
  activity_object: null,
});

interface GetAssignmentsFullParams {
  assignment: any;
  assignment_tasks: any[] | null;
  course_uuid: string | undefined;
  course_object: any | null;
  activity_uuid: string | undefined;
  activity_object: any | null;
}

const getAssignmentsFull = ({
  assignment,
  assignment_tasks,
  course_uuid,
  course_object,
  activity_uuid,
  activity_object,
}: GetAssignmentsFullParams): AssignmentContextType => {
  if (assignment && assignment_tasks && (!course_uuid || course_object) && (!activity_uuid || activity_object)) {
    return {
      assignment_object: assignment,
      assignment_tasks,
      course_object,
      activity_object,
    };
  }

  return {
    assignment_object: null,
    assignment_tasks: null,
    course_object: null,
    activity_object: null,
  };
};

export const AssignmentProvider = ({
  children,
  assignment_uuid,
}: {
  children: ReactNode;
  assignment_uuid: string | undefined;
}) => {
  const session = usePlatformSession();
  const accessToken = session?.data?.tokens?.access_token;
  const t = useTranslations('Contexts.Assignment');

  const { data: assignment, error: assignmentError } = useSWR(
    assignment_uuid && assignment_uuid !== 'undefined' ? `${getAPIUrl()}assignments/${assignment_uuid}` : null,
    (url) => swrFetcher(url, accessToken),
  );

  const { data: assignment_tasks, error: assignmentTasksError } = useSWR(
    assignment_uuid && assignment_uuid !== 'undefined' ? `${getAPIUrl()}assignments/${assignment_uuid}/tasks` : null,
    (url) => swrFetcher(url, accessToken),
  );

  const course_uuid = assignment?.course_uuid;

  const { data: course_object, error: courseObjectError } = useSWR(
    course_uuid ? `${getAPIUrl()}courses/${course_uuid}` : null,
    (url) => swrFetcher(url, accessToken),
  );

  const activity_uuid = assignment?.activity_uuid;

  const { data: activity_object, error: activityObjectError } = useSWR(
    activity_uuid ? `${getAPIUrl()}activities/${activity_uuid}` : null,
    (url) => swrFetcher(url, accessToken),
  );

  // Derive assignmentsFull (memoized to avoid unnecessary context value changes)
  const assignmentsFull: AssignmentContextType = useMemo(
    () =>
      getAssignmentsFull({
        assignment,
        assignment_tasks,
        course_uuid,
        course_object,
        activity_uuid,
        activity_object,
      }),
    [assignment, assignment_tasks, course_uuid, course_object, activity_uuid, activity_object],
  );

  const isLoading =
    !(assignment && assignment_tasks) || (course_uuid && !course_object) || (activity_uuid && !activity_object);
  const hasError = assignmentError || assignmentTasksError || courseObjectError || activityObjectError;

  if (hasError) return <ErrorUI message={t('loadError')} />;

  if (isLoading) return <PageLoading />;

  return <AssignmentContext.Provider value={assignmentsFull}>{children}</AssignmentContext.Provider>;
};

export function useAssignments(): AssignmentContextType {
  return use(AssignmentContext);
}
