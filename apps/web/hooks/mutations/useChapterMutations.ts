'use client';

import { createChapter, deleteChapter, updateChapter, updateCourseOrderStructure } from '@services/courses/chapters';
import type { ChapterCreateValues, ChapterUpdateValues, CourseOrderPayload } from '@/schemas/chapterSchemas';
import { courseKeys } from '@/hooks/courses/courseKeys';
import { useSWRConfig } from 'swr';

export function useChapterMutations(courseUuid: string, withUnpublishedActivities = true) {
  const { mutate, cache } = useSWRConfig();
  const structureKey = courseKeys.structure(courseUuid, withUnpublishedActivities);

  const captureSnapshot = (key: string): unknown | undefined => (cache.get(key) as any)?.data as unknown | undefined;

  const createChapterMutation = async (payload: ChapterCreateValues, accessToken: string) => {
    const tempId = `temp_chapter_${Date.now()}`;
    const optimisticChapter = { ...payload, id: tempId, chapter_uuid: tempId, activities: [] };

    await mutate(
      structureKey,
      (current: any) =>
        current ? { ...current, chapters: [...(current.chapters ?? []), optimisticChapter] } : current,
      { revalidate: false },
    );

    try {
      const createdChapter = await createChapter(payload, accessToken);

      await mutate(
        structureKey,
        (current: any) =>
          current
            ? {
                ...current,
                chapters: (current.chapters ?? []).map((chapter: any) =>
                  chapter.chapter_uuid === tempId ? createdChapter : chapter,
                ),
              }
            : current,
        { revalidate: false },
      );

      await mutate(structureKey);
      return createdChapter;
    } catch (error) {
      await mutate(
        structureKey,
        (current: any) =>
          current
            ? {
                ...current,
                chapters: (current.chapters ?? []).filter((chapter: any) => chapter.chapter_uuid !== tempId),
              }
            : current,
        { revalidate: false },
      );
      throw error;
    }
  };

  const updateChapterMutation = async (chapterUuid: string, payload: ChapterUpdateValues, accessToken: string) => {
    const previous = captureSnapshot(structureKey);

    await mutate(
      structureKey,
      (current: any) =>
        current
          ? {
              ...current,
              chapters: (current.chapters ?? []).map((chapter: any) =>
                chapter.chapter_uuid === chapterUuid ? Object.assign(chapter, payload) : chapter,
              ),
            }
          : current,
      { revalidate: false },
    );

    try {
      const response = await updateChapter(chapterUuid, payload, accessToken);
      await mutate(structureKey);
      return response;
    } catch (error) {
      await mutate(structureKey, previous, { revalidate: false });
      throw error;
    }
  };

  const deleteChapterMutation = async (chapterUuid: string, accessToken: string) => {
    const previous = captureSnapshot(structureKey);

    await mutate(
      structureKey,
      (current: any) =>
        current
          ? {
              ...current,
              chapters: (current.chapters ?? []).filter((chapter: any) => chapter.chapter_uuid !== chapterUuid),
            }
          : current,
      { revalidate: false },
    );

    try {
      const response = await deleteChapter(chapterUuid, accessToken);
      await mutate(structureKey);
      return response;
    } catch (error) {
      await mutate(structureKey, previous, { revalidate: false });
      throw error;
    }
  };

  const reorderStructure = async (nextStructure: any, payload: CourseOrderPayload, accessToken: string) => {
    const previousStructure = captureSnapshot<{ chapters?: any[] }>(structureKey);

    await mutate(structureKey, nextStructure, { revalidate: false });

    try {
      await updateCourseOrderStructure(courseUuid, payload, accessToken);
      await mutate(structureKey);
    } catch (error) {
      await mutate(structureKey, previousStructure, { revalidate: false });
      await mutate(structureKey);
      throw error;
    }
  };

  return {
    createChapter: createChapterMutation,
    deleteChapter: deleteChapterMutation,
    reorderStructure,
    updateChapter: updateChapterMutation,
  };
}
