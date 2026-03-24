'use client';

import { courseKeys } from './courseKeys';
import useSWR from 'swr';

interface UseCourseStructureOptions<TCourseStructure> {
  withUnpublishedActivities?: boolean;
  fallbackData?: TCourseStructure;
}

/**
 * Fetches the course structure (meta + chapters + activities).
 *
 * The auth token is NOT included in the SWR key.  It is injected automatically
 * by the global SWRTokenProvider fetcher in client-layout.tsx.  This keeps
 * cache entries stable across token refreshes.
 */
export function useCourseStructure<TCourseStructure = any>(
  courseUuid: string,
  options?: UseCourseStructureOptions<TCourseStructure>,
) {
  const withUnpublishedActivities = options?.withUnpublishedActivities ?? false;
  const key = courseKeys.structure(courseUuid, withUnpublishedActivities);

  const swr = useSWR<TCourseStructure>(key, {
    fallbackData: options?.fallbackData,
    revalidateOnMount: options?.fallbackData ? false : undefined,
    revalidateIfStale: options?.fallbackData ? false : undefined,
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });

  return {
    ...swr,
    courseStructure: swr.data,
    key,
  };
}

export function useCourseChapters<TChapter = any>(courseUuid: string, withUnpublishedActivities = false) {
  const { courseStructure, ...rest } = useCourseStructure<{ chapters?: TChapter[] }>(courseUuid, {
    withUnpublishedActivities,
  });

  return {
    ...rest,
    chapters: courseStructure?.chapters ?? [],
  };
}

export function useChapter<TChapter = any>(courseUuid: string, chapterUuid: string, withUnpublishedActivities = false) {
  const { courseStructure, ...rest } = useCourseStructure<{ chapters?: TChapter[] }>(courseUuid, {
    withUnpublishedActivities,
  });

  const chapter =
    courseStructure?.chapters?.find((currentChapter: any) => currentChapter.chapter_uuid === chapterUuid) ?? null;

  return { ...rest, chapter };
}

export function useChapterActivities<TActivity = any>(
  courseUuid: string,
  chapterUuid: string,
  enabled: boolean,
  withUnpublishedActivities = false,
) {
  const { chapter, ...rest } = useChapter<{ activities?: TActivity[] }>(
    courseUuid,
    chapterUuid,
    withUnpublishedActivities,
  );

  return {
    ...rest,
    activities: enabled ? (chapter?.activities ?? []) : [],
    isLoading: enabled ? rest.isLoading : false,
  };
}
