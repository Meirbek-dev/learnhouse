'use client';

import { createChapter, deleteChapter, updateChapter, updateCourseOrderStructure } from '@services/courses/chapters';
import { useCourseStructureStore } from '@/stores/courses';
import { courseKeys } from '@/hooks/courses/courseKeys';
import { useSWRConfig } from 'swr';

interface ChapterMutationOptions {
  accessToken: string;
  lastKnownUpdateDate?: string | null;
}

const ensureSuccess = (response: any) => {
  if (response?.status === 409) {
    const error: any = new Error(response?.data?.detail || 'Conflict');
    error.status = 409;
    error.detail = response?.data?.detail;
    throw error;
  }

  return response;
};

const buildOrderSnapshot = (chapters: any[]) =>
  chapters.map((chapter) => ({
    chapterId: chapter.id,
    chapterUuid: chapter.chapter_uuid,
    activityIds: (chapter.activities ?? []).map((activity: any) => ({
      activityId: activity.id,
      activityUuid: activity.activity_uuid,
    })),
  }));

export function useChapterMutations(courseUuid: string, withUnpublishedActivities = true) {
  const { mutate } = useSWRConfig();
  const structureKey = courseKeys.structure(courseUuid, withUnpublishedActivities);

  const createChapterMutation = async (payload: any, options: ChapterMutationOptions) => {
    const tempId = `temp_chapter_${Date.now()}`;
    const optimisticChapter = {
      ...payload,
      id: tempId,
      chapter_uuid: tempId,
      activities: [],
    };

    await mutate(
      structureKey,
      (current: any) =>
        current
          ? {
              ...current,
              chapters: [...(current.chapters ?? []), optimisticChapter],
            }
          : current,
      { revalidate: false },
    );

    try {
      const createdChapter = await createChapter(payload, options.accessToken, {
        courseUuid,
        lastKnownUpdateDate: options.lastKnownUpdateDate,
      });

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

  const updateChapterMutation = async (chapterId: number, payload: any, options: ChapterMutationOptions) => {
    const previous = await mutate(structureKey);

    await mutate(
      structureKey,
      (current: any) =>
        current
          ? {
              ...current,
              chapters: (current.chapters ?? []).map((chapter: any) =>
                chapter.id === chapterId
                  ? {
                      ...chapter,
                      ...payload,
                    }
                  : chapter,
              ),
            }
          : current,
      { revalidate: false },
    );

    try {
      const response = await updateChapter(chapterId, payload, options.accessToken, {
        courseUuid,
        lastKnownUpdateDate: options.lastKnownUpdateDate,
      });
      ensureSuccess(response);
      await mutate(structureKey);
      return response;
    } catch (error) {
      await mutate(structureKey, previous, { revalidate: false });
      throw error;
    }
  };

  const deleteChapterMutation = async (chapterId: number, options: ChapterMutationOptions) => {
    const previous = await mutate(structureKey);

    await mutate(
      structureKey,
      (current: any) =>
        current
          ? {
              ...current,
              chapters: (current.chapters ?? []).filter((chapter: any) => chapter.id !== chapterId),
            }
          : current,
      { revalidate: false },
    );

    try {
      const response = await deleteChapter(chapterId, options.accessToken, {
        courseUuid,
        lastKnownUpdateDate: options.lastKnownUpdateDate,
      });
      ensureSuccess(response);
      await mutate(structureKey);
      return response;
    } catch (error) {
      await mutate(structureKey, previous, { revalidate: false });
      throw error;
    }
  };

  const reorderStructure = async (nextStructure: any, payload: any, options: ChapterMutationOptions) => {
    const previousStructure = await mutate(structureKey);
    const dragStore = useCourseStructureStore.getState();
    const nextSnapshot = buildOrderSnapshot(nextStructure.chapters ?? []);

    dragStore.beginDrag(buildOrderSnapshot(previousStructure?.chapters ?? []));
    dragStore.updateDragOrder(nextSnapshot);

    await mutate(structureKey, nextStructure, { revalidate: false });
    dragStore.markDragSaving();

    try {
      await updateCourseOrderStructure(courseUuid, payload, options.accessToken, {
        courseUuid,
      });
      dragStore.commitDrag();
      await mutate(structureKey);
    } catch (error) {
      dragStore.rollbackDrag();
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
