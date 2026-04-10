'use client';

import { useQuery } from '@tanstack/react-query';
import {
  codeChallengeSettingsQueryOptions,
  codeChallengeSubmissionQueryOptions,
  codeChallengeSubmissionsQueryOptions,
} from '../queries/code-challenges.query';

export function useCodeChallengeSettings<TSettings = unknown>(activityUuid: string | null | undefined) {
  return useQuery({
    ...codeChallengeSettingsQueryOptions<TSettings>(activityUuid ?? ''),
    enabled: Boolean(activityUuid),
  });
}

export function useCodeChallengeSubmissions<TSubmission = unknown>(activityUuid: string | null | undefined) {
  return useQuery({
    ...codeChallengeSubmissionsQueryOptions<TSubmission>(activityUuid ?? ''),
    enabled: Boolean(activityUuid),
  });
}

export function useCodeChallengeSubmission<TSubmission = unknown>(
  submissionUuid: string | null,
  options?: { refetchInterval?: number | false },
) {
  return useQuery({
    ...codeChallengeSubmissionQueryOptions<TSubmission>(submissionUuid ?? ''),
    enabled: Boolean(submissionUuid),
    refetchInterval: options?.refetchInterval,
  });
}
