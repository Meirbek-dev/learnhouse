'use client';

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
import { useCourseEditorStore } from '@/stores/courses';
import { useSWRConfig } from 'swr';

interface ActivityMutationOptions {
  accessToken: string;
  lastKnownUpdateDate?: string | null;
}

export function useActivityMutations(courseUuid: string, withUnpublishedActivities = true) {
  const { mutate, cache } = useSWRConfig();
  const structureKey = courseKeys.structure(courseUuid, withUnpublishedActivities);

  const captureSnapshot = (key: string): unknown | undefined => (cache.get(key) as any)?.data as unknown | undefined;

  const updateActivityMutation = async (
    activityUuid: string,
    payload: Partial<ActivityUpdateValues>,
    options: ActivityMutationOptions,
  ) => {
    const previousStructure = captureSnapshot(structureKey);
    const activityKey = courseKeys.activity(activityUuid);
    const previousActivity = captureSnapshot(activityKey);

    await mutate(
      structureKey,
      (current: any) =>
        current
          ? {
              ...current,
              chapters: (current.chapters ?? []).map((chapter: any) =>
                Object.assign(chapter, {
                  activities: (chapter.activities ?? []).map((activity: any) =>
                    activity.activity_uuid === activityUuid ? { ...activity, ...payload } : activity,
                  ),
                }),
              ),
            }
          : current,
      { revalidate: false },
    );

    await mutate(activityKey, (current: any) => (current ? { ...current, ...payload } : current), {
      revalidate: false,
    });

    try {
      const response = assertSuccess(
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
    const previousStructure = captureSnapshot(structureKey);

    await mutate(
      structureKey,
      (current: any) =>
        current
          ? {
              ...current,
              chapters: (current.chapters ?? []).map((chapter: any) =>
                Object.assign(chapter, {
                  activities: (chapter.activities ?? []).filter(
                    (activity: any) => activity.activity_uuid !== activityUuid,
                  ),
                }),
              ),
            }
          : current,
      { revalidate: false },
    );

    try {
      const response = assertSuccess(
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

  const createActivityMutation = async (
    payload: ActivityCreateValues,
    chapterId: number,
    options: ActivityMutationOptions,
  ) => {
    const response = assertSuccess(
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
    payload: Partial<ActivityCreateValues>,
    chapterId: number,
    options: ActivityMutationOptions,
    onProgress?: (progress: { percentage: number }) => void,
  ) => {
    const response = await createFileActivity(
      file,
      type,
      payload,
      chapterId,
      options.accessToken,
      {
        courseUuid,
        lastKnownUpdateDate: options.lastKnownUpdateDate,
      },
      onProgress,
    );
    await mutate(structureKey);
    return response;
  };

  const createExternalVideoMutation = async (
    externalVideoData: Record<string, unknown>,
    activityPayload: Partial<ActivityCreateValues>,
    chapterId: number,
    options: ActivityMutationOptions,
  ) => {
    const response = assertSuccess(
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
