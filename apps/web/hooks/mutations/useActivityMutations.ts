'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createActivity,
  createExternalVideoActivity,
  createFileActivity,
  deleteActivity,
  updateActivity,
} from '@services/courses/activities';
import type { ActivityCreateValues, ActivityUpdateValues } from '@/schemas/activitySchemas';
import { courseKeys } from '@/hooks/courses/courseKeys';
import { assertSuccess } from '@/lib/api/assertSuccess';

export function useActivityMutations(courseUuid: string, withUnpublishedActivities = true) {
  const queryClient = useQueryClient();
  const structureKey = courseKeys.structure(courseUuid, withUnpublishedActivities);
  const updateActivityMutation = useMutation({
    mutationFn: async ({ activityUuid, payload }: { activityUuid: string; payload: Partial<ActivityUpdateValues> }) =>
      assertSuccess(await updateActivity(payload, activityUuid)),
    onMutate: async ({ activityUuid, payload }) => {
      const activityKey = courseKeys.activity(activityUuid);

      await Promise.all([
        queryClient.cancelQueries({ queryKey: structureKey }),
        queryClient.cancelQueries({ queryKey: activityKey }),
      ]);

      const previousStructure = queryClient.getQueryData(structureKey);
      const previousActivity = queryClient.getQueryData(activityKey);

      queryClient.setQueryData(structureKey, (current: any) =>
        current
          ? {
              ...current,
              chapters: (current.chapters ?? []).map((chapter: any) => (Object.assign(chapter, {activities:(chapter.activities??[]).map((activity:any)=>activity.activity_uuid===activityUuid?{...activity,...payload}:activity)}))),
            }
          : current,
      );

      queryClient.setQueryData(activityKey, (current: any) => (current ? { ...current, ...payload } : current));

      return { activityKey, previousActivity, previousStructure };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(structureKey, context.previousStructure);
      queryClient.setQueryData(context.activityKey, context.previousActivity);
    },
    onSettled: async (_data, _error, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: structureKey }),
        queryClient.invalidateQueries({ queryKey: courseKeys.activity(variables.activityUuid) }),
      ]);
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (activityUuid: string) => assertSuccess(await deleteActivity(activityUuid)),
    onMutate: async (activityUuid) => {
      await queryClient.cancelQueries({ queryKey: structureKey });
      const previousStructure = queryClient.getQueryData(structureKey);

      queryClient.setQueryData(structureKey, (current: any) =>
        current
          ? {
              ...current,
              chapters: (current.chapters ?? []).map((chapter: any) => (Object.assign(chapter, {activities:(chapter.activities??[]).filter((activity:any)=>activity.activity_uuid!==activityUuid)}))),
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

  const createActivityMutation = useMutation({
    mutationFn: async ({ chapterId, payload }: { chapterId: number; payload: ActivityCreateValues }) =>
      assertSuccess(await createActivity(payload, chapterId)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: structureKey });
    },
  });

  const createFileActivityMutation = useMutation({
    mutationFn: async ({
      chapterId,
      file,
      onProgress,
      payload,
      type,
    }: {
      chapterId: number;
      file: File;
      onProgress?: (progress: { percentage: number }) => void;
      payload: Partial<ActivityCreateValues>;
      type: string;
    }) => createFileActivity(file, type, payload, chapterId, undefined, onProgress),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: structureKey });
    },
  });

  const createExternalVideoMutation = useMutation({
    mutationFn: async ({
      activityPayload,
      chapterId,
      externalVideoData,
    }: {
      activityPayload: Partial<ActivityCreateValues>;
      chapterId: number;
      externalVideoData: Record<string, unknown>;
    }) => assertSuccess(await createExternalVideoActivity(externalVideoData, activityPayload, chapterId)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: structureKey });
    },
  });

  return {
    createActivity: async (payload: ActivityCreateValues, chapterId: number) =>
      createActivityMutation.mutateAsync({ chapterId, payload }),
    createExternalVideo: async (
      externalVideoData: Record<string, unknown>,
      activityPayload: Partial<ActivityCreateValues>,
      chapterId: number,
    ) => createExternalVideoMutation.mutateAsync({ activityPayload, chapterId, externalVideoData }),
    createFileActivity: async (
      file: File,
      type: string,
      payload: Partial<ActivityCreateValues>,
      chapterId: number,
      onProgress?: (progress: { percentage: number }) => void,
    ) => createFileActivityMutation.mutateAsync({ chapterId, file, onProgress, payload, type }),
    deleteActivity: async (activityUuid: string) => deleteActivityMutation.mutateAsync(activityUuid),
    updateActivity: async (activityUuid: string, payload: Partial<ActivityUpdateValues>) =>
      updateActivityMutation.mutateAsync({ activityUuid, payload }),
  };
}
