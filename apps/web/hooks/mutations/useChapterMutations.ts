'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createChapter, deleteChapter, updateChapter, updateCourseOrderStructure } from '@services/courses/chapters';
import type { ChapterCreateValues, ChapterUpdateValues, CourseOrderPayload } from '@/schemas/chapterSchemas';
import { courseKeys } from '@/hooks/courses/courseKeys';

export function useChapterMutations(courseUuid: string, withUnpublishedActivities = true) {
  const queryClient = useQueryClient();
  const structureKey = courseKeys.structure(courseUuid, withUnpublishedActivities);
  const createChapterMutation = useMutation({
    mutationFn: async ({ payload }: { payload: ChapterCreateValues }) => createChapter(payload),
    onMutate: async ({ payload }) => {
      const tempId = `temp_chapter_${Date.now()}`;
      const optimisticChapter = { ...payload, id: tempId, chapter_uuid: tempId, activities: [] };

      await queryClient.cancelQueries({ queryKey: structureKey });
      const previousStructure = queryClient.getQueryData(structureKey);

      queryClient.setQueryData(structureKey, (current: any) =>
        current ? { ...current, chapters: [...(current.chapters ?? []), optimisticChapter] } : current,
      );

      return { previousStructure, tempId };
    },
    onSuccess: (createdChapter, _variables, context) => {
      queryClient.setQueryData(structureKey, (current: any) =>
        current
          ? {
              ...current,
              chapters: (current.chapters ?? []).map((chapter: any) =>
                chapter.chapter_uuid === context?.tempId ? createdChapter : chapter,
              ),
            }
          : current,
      );
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(structureKey, context?.previousStructure);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: structureKey });
    },
  });

  const updateChapterMutation = useMutation({
    mutationFn: async ({ chapterUuid, payload }: { chapterUuid: string; payload: ChapterUpdateValues }) =>
      updateChapter(chapterUuid, payload),
    onMutate: async ({ chapterUuid, payload }) => {
      await queryClient.cancelQueries({ queryKey: structureKey });
      const previousStructure = queryClient.getQueryData(structureKey);

      queryClient.setQueryData(structureKey, (current: any) =>
        current
          ? {
              ...current,
              chapters: (current.chapters ?? []).map((chapter: any) =>
                chapter.chapter_uuid === chapterUuid ? Object.assign(chapter, payload) : chapter,
              ),
            }
          : current,
      );

      return { previousStructure };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(structureKey, context?.previousStructure);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: structureKey });
    },
  });

  const deleteChapterMutation = useMutation({
    mutationFn: async (chapterUuid: string) => deleteChapter(chapterUuid),
    onMutate: async (chapterUuid) => {
      await queryClient.cancelQueries({ queryKey: structureKey });
      const previousStructure = queryClient.getQueryData(structureKey);

      queryClient.setQueryData(structureKey, (current: any) =>
        current
          ? {
              ...current,
              chapters: (current.chapters ?? []).filter((chapter: any) => chapter.chapter_uuid !== chapterUuid),
            }
          : current,
      );

      return { previousStructure };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(structureKey, context?.previousStructure);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: structureKey });
    },
  });

  const reorderStructureMutation = useMutation({
    mutationFn: async ({ payload }: { nextStructure: any; payload: CourseOrderPayload }) =>
      updateCourseOrderStructure(courseUuid, payload),
    onMutate: async ({ nextStructure }) => {
      await queryClient.cancelQueries({ queryKey: structureKey });
      const previousStructure = queryClient.getQueryData(structureKey);
      queryClient.setQueryData(structureKey, nextStructure);
      return { previousStructure };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(structureKey, context?.previousStructure);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: structureKey });
    },
  });

  return {
    createChapter: async (payload: ChapterCreateValues) => createChapterMutation.mutateAsync({ payload }),
    deleteChapter: async (chapterUuid: string) => deleteChapterMutation.mutateAsync(chapterUuid),
    reorderStructure: async (nextStructure: any, payload: CourseOrderPayload) =>
      reorderStructureMutation.mutateAsync({ nextStructure, payload }),
    updateChapter: async (chapterUuid: string, payload: ChapterUpdateValues) =>
      updateChapterMutation.mutateAsync({ chapterUuid, payload }),
  };
}
