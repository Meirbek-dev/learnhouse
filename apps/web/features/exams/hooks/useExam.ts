'use client';

import { useQuery } from '@tanstack/react-query';
import {
  examActivityQueryOptions,
  examAllAttemptsQueryOptions,
  examConfigQueryOptions,
  examMyAttemptsQueryOptions,
  examQuestionsQueryOptions,
} from '../queries/exams.query';

export function useExamActivity(activityUuid: string | null | undefined) {
  return useQuery({
    ...examActivityQueryOptions(activityUuid ?? ''),
    enabled: Boolean(activityUuid),
  });
}

export function useExamQuestions(examUuid: string | null | undefined) {
  return useQuery({
    ...examQuestionsQueryOptions(examUuid ?? ''),
    enabled: Boolean(examUuid),
  });
}

export function useExamMyAttempts(examUuid: string | null | undefined) {
  return useQuery({
    ...examMyAttemptsQueryOptions(examUuid ?? ''),
    enabled: Boolean(examUuid),
  });
}

export function useExamAllAttempts(examUuid: string | null | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    ...examAllAttemptsQueryOptions(examUuid ?? ''),
    enabled: Boolean(examUuid) && (options?.enabled ?? true),
  });
}

export function useExamConfig() {
  return useQuery(examConfigQueryOptions());
}
