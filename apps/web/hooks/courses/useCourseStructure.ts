'use client';

import { swrFetcher } from '@services/utils/ts/requests';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { courseKeys } from './courseKeys';
import useSWR from 'swr';

interface UseCourseStructureOptions<TCourseStructure> {
  withUnpublishedActivities?: boolean;
  fallbackData?: TCourseStructure;
}

export function useCourseStructure<TCourseStructure = any>(
  courseUuid: string,
  options?: UseCourseStructureOptions<TCourseStructure>,
) {
  const session = usePlatformSession();
  const accessToken = session?.data?.tokens?.access_token;
  const withUnpublishedActivities = options?.withUnpublishedActivities ?? false;
  const key = [courseKeys.structure(courseUuid, withUnpublishedActivities), accessToken ?? 'anonymous'] as const;

  const swr = useSWR<TCourseStructure>(
    key,
    ([url, token]: readonly [string, string]) => swrFetcher(url, token === 'anonymous' ? undefined : token),
    {
      fallbackData: options?.fallbackData,
      revalidateOnMount: options?.fallbackData ? false : undefined,
      revalidateIfStale: options?.fallbackData ? false : undefined,
      revalidateOnFocus: false,
      dedupingInterval: 5_000,
    },
  );

  return {
    ...swr,
    courseStructure: swr.data,
    key: key[0],
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

  const chapter = courseStructure?.chapters?.find((currentChapter: any) => currentChapter.chapter_uuid === chapterUuid) ?? null;

  return {
    ...rest,
    chapter,
  };
}

export function useChapterActivities<TActivity = any>(
  courseUuid: string,
  chapterUuid: string,
  enabled: boolean,
  withUnpublishedActivities = false,
) {
  const { chapter, ...rest } = useChapter<{ activities?: TActivity[] }>(courseUuid, chapterUuid, withUnpublishedActivities);

  return {
    ...rest,
    activities: enabled ? chapter?.activities ?? [] : [],
    isLoading: enabled ? rest.isLoading : false,
  };
}
