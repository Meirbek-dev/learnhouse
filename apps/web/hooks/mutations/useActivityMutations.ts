'use client';

import { createActivity, createExternalVideoActivity, createFileActivity, deleteActivity, updateActivity } from '@services/courses/activities';
import { useCourseEditorStore } from '@/stores/courses';
import { courseKeys } from '@/hooks/courses/courseKeys';
import { useSWRConfig } from 'swr';

interface ActivityMutationOptions {
  accessToken: string;
  lastKnownUpdateDate?: string | null;
}

const toError = (errorLike: any) => {
  if (errorLike?.success) {
    return errorLike;
  }

  const error: any = new Error(errorLike?.data?.detail || errorLike?.message || errorLike?.HTTPmessage || 'Request failed');
  error.status = errorLike?.status ?? 500;
  error.detail = errorLike?.data?.detail ?? errorLike?.detail;
  error.data = errorLike?.data;
  throw error;
};

export function useActivityMutations(courseUuid: string, withUnpublishedActivities = true) {
  const { mutate } = useSWRConfig();
  const structureKey = courseKeys.structure(courseUuid, withUnpublishedActivities);

  const updateActivityMutation = async (activityUuid: string, payload: any, options: ActivityMutationOptions) => {
    const previousStructure = await mutate(structureKey);
    const activityKey = courseKeys.activity(activityUuid);
    const previousActivity = await mutate(activityKey);

    await mutate(
      structureKey,
      (current: any) =>
        current
          ? {
              ...current,
              chapters: (current.chapters ?? []).map((chapter: any) => ({
                ...chapter,
                activities: (chapter.activities ?? []).map((activity: any) =>
                  activity.activity_uuid === activityUuid
                    ? {
                        ...activity,
                        ...payload,
                      }
                    : activity,
                ),
              })),
            }
          : current,
      { revalidate: false },
    );

    await mutate(
      activityKey,
      (current: any) =>
        current
          ? {
              ...current,
              ...payload,
            }
          : current,
      { revalidate: false },
    );

    try {
      const response = toError(
        await updateActivity(payload, activityUuid, options.accessToken, {
          courseUuid,
          lastKnownUpdateDate: options.lastKnownUpdateDate,
        }),
      );
      useCourseEditorStore.getState().syncLastKnownUpdateDate(response?.data?.update_date);
      await Promise.all([mutate(structureKey), mutate(activityKey)]);
      return response;
    } catch (error) {
      await Promise.all([
        mutate(structureKey, previousStructure, { revalidate: false }),
        mutate(activityKey, previousActivity, { revalidate: false }),
      ]);
      throw error;
    }
  };

  const deleteActivityMutation = async (activityUuid: string, options: ActivityMutationOptions) => {
    const previousStructure = await mutate(structureKey);

    await mutate(
      structureKey,
      (current: any) =>
        current
          ? {
              ...current,
              chapters: (current.chapters ?? []).map((chapter: any) => ({
                ...chapter,
                activities: (chapter.activities ?? []).filter((activity: any) => activity.activity_uuid !== activityUuid),
              })),
            }
          : current,
      { revalidate: false },
    );

    try {
      const response = toError(
        await deleteActivity(activityUuid, options.accessToken, {
          courseUuid,
          lastKnownUpdateDate: options.lastKnownUpdateDate,
        }),
      );
      await mutate(structureKey);
      return response;
    } catch (error) {
      await mutate(structureKey, previousStructure, { revalidate: false });
      throw error;
    }
  };

  const createActivityMutation = async (payload: any, chapterId: number, options: ActivityMutationOptions) => {
    const response = toError(
      await createActivity(payload, chapterId, options.accessToken, {
        courseUuid,
        lastKnownUpdateDate: options.lastKnownUpdateDate,
      }),
    );
    await mutate(structureKey);
    return response;
  };

  const createFileActivityMutation = async (
    file: File,
    type: string,
    payload: any,
    chapterId: number,
    options: ActivityMutationOptions,
    onProgress?: (progress: { percentage: number }) => void,
  ) => {
    const response = await createFileActivity(file, type, payload, chapterId, options.accessToken, {
      courseUuid,
      lastKnownUpdateDate: options.lastKnownUpdateDate,
    }, onProgress);
    await mutate(structureKey);
    return response;
  };

  const createExternalVideoMutation = async (
    externalVideoData: any,
    activityPayload: any,
    chapterId: number,
    options: ActivityMutationOptions,
  ) => {
    const response = toError(
      await createExternalVideoActivity(externalVideoData, activityPayload, chapterId, options.accessToken, {
        courseUuid,
        lastKnownUpdateDate: options.lastKnownUpdateDate,
      }),
    );
    await mutate(structureKey);
    return response;
  };

  return {
    createActivity: createActivityMutation,
    createExternalVideo: createExternalVideoMutation,
    createFileActivity: createFileActivityMutation,
    deleteActivity: deleteActivityMutation,
    updateActivity: updateActivityMutation,
  };
}
