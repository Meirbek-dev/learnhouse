'use client';

import { apiFetcher } from '@/lib/api-client';
import { queryOptions } from '@tanstack/react-query';
import { getAPIUrl } from '@services/config/config';
import { queryKeys } from '@/lib/react-query/queryKeys';

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

export function activityDetailQueryOptions(activityUuid: string) {
  return queryOptions({
    queryKey: queryKeys.activities.detail(activityUuid),
    queryFn: () => apiFetcher(`${getAPIUrl()}activities/${activityUuid}`),
  });
}
