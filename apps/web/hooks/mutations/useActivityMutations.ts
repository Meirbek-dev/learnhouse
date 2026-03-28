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
import { useSWRConfig } from 'swr';

export function useActivityMutations(courseUuid: string, withUnpublishedActivities = true) {
  const { mutate, cache } = useSWRConfig();
  const structureKey = courseKeys.structure(courseUuid, withUnpublishedActivities);

  const captureSnapshot = (key: string): unknown | undefined => (cache.get(key) as any)?.data as unknown | undefined;

  const updateActivityMutation = async (
    activityUuid: string,
    payload: Partial<ActivityUpdateValues>,
    accessToken: string,
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
              chapters: (current.chapters ?? []).map((chapter: any) => ({
                ...chapter,
                activities: (chapter.activities ?? []).map((activity: any) =>
                  activity.activity_uuid === activityUuid ? { ...activity, ...payload } : activity,
                ),
              })),
            }
          : current,
      { revalidate: false },
    );

    await mutate(activityKey, (current: any) => (current ? { ...current, ...payload } : current), {
      revalidate: false,
    });

    try {
      const response = assertSuccess(await updateActivity(payload, activityUuid, accessToken));
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

  const deleteActivityMutation = async (activityUuid: string, accessToken: string) => {
    const previousStructure = captureSnapshot(structureKey);

    await mutate(
      structureKey,
      (current: any) =>
        current
          ? {
              ...current,
              chapters: (current.chapters ?? []).map((chapter: any) => ({
                ...chapter,
                activities: (chapter.activities ?? []).filter(
                  (activity: any) => activity.activity_uuid !== activityUuid,
                ),
              })),
            }
          : current,
      { revalidate: false },
    );

    try {
      const response = assertSuccess(await deleteActivity(activityUuid, accessToken));
      await mutate(structureKey);
      return response;
    } catch (error) {
      await mutate(structureKey, previousStructure, { revalidate: false });
      throw error;
    }
  };

  const createActivityMutation = async (payload: ActivityCreateValues, chapterId: number, accessToken: string) => {
    const response = assertSuccess(await createActivity(payload, chapterId, accessToken));
    await mutate(structureKey);
    return response;
  };

  const createFileActivityMutation = async (
    file: File,
    type: string,
    payload: Partial<ActivityCreateValues>,
    chapterId: number,
    accessToken: string,
    onProgress?: (progress: { percentage: number }) => void,
  ) => {
    const response = await createFileActivity(file, type, payload, chapterId, accessToken, undefined, onProgress);
    await mutate(structureKey);
    return response;
  };

  const createExternalVideoMutation = async (
    externalVideoData: Record<string, unknown>,
    activityPayload: Partial<ActivityCreateValues>,
    chapterId: number,
    accessToken: string,
  ) => {
    const response = assertSuccess(
      await createExternalVideoActivity(externalVideoData, activityPayload, chapterId, accessToken),
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
