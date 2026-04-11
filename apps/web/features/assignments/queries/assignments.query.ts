'use client';

import { getAssignmentTaskSubmissionsMe } from '@services/courses/assignments';
import { apiFetcher } from '@/lib/api-client';
import { queryOptions } from '@tanstack/react-query';
import { getAPIUrl } from '@services/config/config';
import { queryKeys } from '@/lib/react-query/queryKeys';

async function fetchAssignmentTaskSubmission<TTaskSubmission = unknown>(
  assignmentUuid: string,
  assignmentTaskUuid: string,
): Promise<TTaskSubmission | null> {
  const response = await getAssignmentTaskSubmissionsMe(assignmentTaskUuid, assignmentUuid);

  if (!response.success || !response.data) {
    return null;
  }

  return response.data as TTaskSubmission;
}

export function assignmentDetailQueryOptions(assignmentUuid: string) {
  return queryOptions({
    queryKey: queryKeys.assignments.detail(assignmentUuid),
    queryFn: () => apiFetcher(`${getAPIUrl()}assignments/${assignmentUuid}`),
  });
}

export function assignmentTasksQueryOptions(assignmentUuid: string) {
  return queryOptions({
    queryKey: queryKeys.assignments.tasks(assignmentUuid),
    queryFn: () => apiFetcher(`${getAPIUrl()}assignments/${assignmentUuid}/tasks`),
  });
}

export function assignmentSubmissionsQueryOptions<TAssignmentSubmissionRow = unknown>(assignmentUuid: string) {
  return queryOptions({
    queryKey: queryKeys.assignments.submissions(assignmentUuid),
    queryFn: () => apiFetcher(`${getAPIUrl()}assignments/${assignmentUuid}/submissions`) as Promise<TAssignmentSubmissionRow[]>,
  });
}

export function assignmentTaskSubmissionQueryOptions<TTaskSubmission = unknown>(
  assignmentUuid: string,
  assignmentTaskUuid: string,
) {
  return queryOptions({
    queryKey: queryKeys.assignments.taskSubmission(assignmentUuid, assignmentTaskUuid),
    queryFn: () => fetchAssignmentTaskSubmission<TTaskSubmission>(assignmentUuid, assignmentTaskUuid),
    refetchOnWindowFocus: false,
  });
}

export function activityDetailQueryOptions(activityUuid: string) {
  return queryOptions({
    queryKey: queryKeys.activities.detail(activityUuid),
    queryFn: () => apiFetcher(`${getAPIUrl()}activities/${activityUuid}`),
  });
}
