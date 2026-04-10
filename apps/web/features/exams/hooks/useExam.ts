'use client';

import { queryOptions, useQuery } from '@tanstack/react-query';
import {
  examActivityQueryOptions,
  examAllAttemptsQueryOptions,
  examConfigQueryOptions,
  examMyAttemptsQueryOptions,
  examQuestionsQueryOptions,
} from '../queries/exams.query';

function examActivityHookOptions(activityUuid: string | null | undefined) {
  const normalizedActivityUuid = activityUuid ?? '';

  return queryOptions({
    ...examActivityQueryOptions(normalizedActivityUuid),
    enabled: Boolean(activityUuid),
  });
}

function examQuestionsHookOptions(examUuid: string | null | undefined) {
  const normalizedExamUuid = examUuid ?? '';

  return queryOptions({
    ...examQuestionsQueryOptions(normalizedExamUuid),
    enabled: Boolean(examUuid),
  });
}

function examMyAttemptsHookOptions(examUuid: string | null | undefined) {
  const normalizedExamUuid = examUuid ?? '';

  return queryOptions({
    ...examMyAttemptsQueryOptions(normalizedExamUuid),
    enabled: Boolean(examUuid),
  });
}

function examAllAttemptsHookOptions(examUuid: string | null | undefined, enabled = true) {
  const normalizedExamUuid = examUuid ?? '';

  return queryOptions({
    ...examAllAttemptsQueryOptions(normalizedExamUuid),
    enabled: Boolean(examUuid) && enabled,
  });
}

export function useExamActivity(activityUuid: string | null | undefined) {
  return useQuery(examActivityHookOptions(activityUuid));
}

export function useExamQuestions(examUuid: string | null | undefined) {
  return useQuery(examQuestionsHookOptions(examUuid));
}

export function useExamMyAttempts(examUuid: string | null | undefined) {
  return useQuery(examMyAttemptsHookOptions(examUuid));
}

export function useExamAllAttempts(examUuid: string | null | undefined, options?: { enabled?: boolean }) {
  return useQuery(examAllAttemptsHookOptions(examUuid, options?.enabled ?? true));
}

export function useExamConfig() {
  return useQuery(examConfigQueryOptions());
}
