'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetcher } from '@services/utils/ts/requests';
import { courseEndpoints, courseKeys } from './courseKeys';

interface UseCourseStructureOptions<TCourseStructure> {
  withUnpublishedActivities?: boolean;
  fallbackData?: TCourseStructure;
}

/**
 * Fetches the course structure (meta + chapters + activities).
 *
 * The auth token is NOT included in the SWR key.  It is injected automatically
 * by the global SWR provider fetcher in root-providers.tsx.  This keeps
 * cache entries stable across token refreshes.
 */
export function useCourseStructure<TCourseStructure = any>(
  courseUuid: string,
  options?: UseCourseStructureOptions<TCourseStructure>,
) {
  const withUnpublishedActivities = options?.withUnpublishedActivities ?? false;
  const key = courseKeys.structure(courseUuid, withUnpublishedActivities);

  const query = useQuery({
    queryKey: key,
    queryFn: () => apiFetcher(courseEndpoints.structure(courseUuid, withUnpublishedActivities)) as Promise<TCourseStructure>,
    enabled: Boolean(courseUuid),
    initialData: options?.fallbackData,
    staleTime: 5000,
  });

  return {
    ...query,
    courseStructure: query.data,
    isLoading: query.isPending,
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
