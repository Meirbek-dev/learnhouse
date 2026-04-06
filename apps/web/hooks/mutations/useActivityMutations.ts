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

  const captureSnapshot = (key: string) => (cache.get(key as any) as any)?.data ?? undefined;

  const updateActivityMutation = async (activityUuid: string, payload: Partial<ActivityUpdateValues>) => {
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
                    activity.activity_uuid === activityUuid ? Object.assign(activity, payload) : activity,
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
      const response = assertSuccess(await updateActivity(payload, activityUuid));
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

  const deleteActivityMutation = async (activityUuid: string) => {
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
      const response = assertSuccess(await deleteActivity(activityUuid));
      await mutate(structureKey);
      return response;
    } catch (error) {
      await mutate(structureKey, previousStructure, { revalidate: false });
      throw error;
    }
  };

  const createActivityMutation = async (payload: ActivityCreateValues, chapterId: number) => {
    const response = assertSuccess(await createActivity(payload, chapterId));
    await mutate(structureKey);
    return response;
  };

  const createFileActivityMutation = async (
    file: File,
    type: string,
    payload: Partial<ActivityCreateValues>,
    chapterId: number,
    onProgress?: (progress: { percentage: number }) => void,
  ) => {
    const response = await createFileActivity(file, type, payload, chapterId, undefined, onProgress);
    await mutate(structureKey);
    return response;
  };

  const createExternalVideoMutation = async (
    externalVideoData: Record<string, unknown>,
    activityPayload: Partial<ActivityCreateValues>,
    chapterId: number,
  ) => {
    const response = assertSuccess(await createExternalVideoActivity(externalVideoData, activityPayload, chapterId));
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
