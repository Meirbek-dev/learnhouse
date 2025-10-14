'use client';

import ErrorUI from '@components/Objects/StyledElements/Error/Error';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import PageLoading from '@components/Objects/Loaders/PageLoading';
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

export const AssignmentProvider = ({
  children,
  assignment_uuid,
}: {
  children: ReactNode;
  assignment_uuid: string | undefined;
}) => {
  const session = useLHSession();
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

  const course_id = assignment?.course_id;

  const { data: course_object, error: courseObjectError } = useSWR(
    course_id ? `${getAPIUrl()}courses/id/${course_id}` : null,
    (url) => swrFetcher(url, accessToken),
  );

  const activity_id = assignment?.activity_id;

  const { data: activity_object, error: activityObjectError } = useSWR(
    activity_id ? `${getAPIUrl()}activities/id/${activity_id}` : null,
    (url) => swrFetcher(url, accessToken),
  );

  // Derive assignmentsFull using useMemo instead of setState in effect
  const assignmentsFull = useMemo<AssignmentContextType>(() => {
    if (assignment && assignment_tasks && (!course_id || course_object) && (!activity_id || activity_object)) {
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
  }, [assignment, assignment_tasks, course_object, activity_object, course_id, activity_id]);

  const isLoading =
    !(assignment && assignment_tasks) || (course_id && !course_object) || (activity_id && !activity_object);
  const hasError = assignmentError || assignmentTasksError || courseObjectError || activityObjectError;

  if (hasError) return <ErrorUI message={t('loadError')} />;

  if (isLoading) return <PageLoading />;

  return <AssignmentContext value={assignmentsFull}>{children}</AssignmentContext>;
};

export function useAssignments(): AssignmentContextType {
  return use(AssignmentContext);
}
