'use client';

import { useActivityMutations } from '@/hooks/mutations/useActivityMutations';
import { useCourseEditorStore } from '@/stores/courses';
import { useDebouncedCallback } from '@/hooks/useDebounce';
import { useCallback } from 'react';

interface ActivityAutosaveOptions {
  activityUuid: string;
  courseUuid: string;
  accessToken: string;
  lastKnownUpdateDate?: string | null;
  delay?: number;
}

export function useActivityAutosave(options: ActivityAutosaveOptions) {
  const { updateActivity } = useActivityMutations(options.courseUuid, true);
  const activitySaveStatus = useCourseEditorStore((state) => state.activitySaveStatus);
  const lastActivitySavedAt = useCourseEditorStore((state) => state.lastActivitySavedAt);
  const setDraft = useCourseEditorStore((state) => state.setDraft);
  const clearDraft = useCourseEditorStore((state) => state.clearDraft);
  const setConflict = useCourseEditorStore((state) => state.setConflict);
  const setActivitySaveStatus = useCourseEditorStore((state) => state.setActivitySaveStatus);

  const persistDraft = useCallback(
    async (payload: any) => {
      setActivitySaveStatus('saving');

      try {
        await updateActivity(options.activityUuid, payload, {
          accessToken: options.accessToken,
          lastKnownUpdateDate: useCourseEditorStore.getState().lastKnownUpdateDate ?? options.lastKnownUpdateDate,
        });
        clearDraft('activity');
        setActivitySaveStatus('saved');
      } catch (error: any) {
        setActivitySaveStatus('error');
        if (error?.status === 409) {
          setConflict({
            message: error?.detail || error?.message,
            section: 'activity',
            pendingSave: async () => {
              await updateActivity(options.activityUuid, payload, {
                accessToken: options.accessToken,
                lastKnownUpdateDate: useCourseEditorStore.getState().lastKnownUpdateDate,
              });
              clearDraft('activity');
              setActivitySaveStatus('saved');
            },
          });
        }
        throw error;
      }
    },
    [clearDraft, options.accessToken, options.activityUuid, options.lastKnownUpdateDate, setActivitySaveStatus, setConflict, updateActivity],
  );

  const debouncedSave = useDebouncedCallback((payload: any) => {
    void persistDraft(payload);
  }, options.delay ?? 1_500);

  const onChange = useCallback(
    (payload: any) => {
      setDraft('activity', payload);
      setActivitySaveStatus('saving');
      debouncedSave(payload);
    },
    [debouncedSave, setActivitySaveStatus, setDraft],
  );

  const flush = useCallback(
    async (payload: any) => {
      setDraft('activity', payload);
      await persistDraft(payload);
    },
    [persistDraft, setDraft],
  );

  return {
    flush,
    onChange,
    lastSavedAt: lastActivitySavedAt,
    saveStatus: activitySaveStatus,
  };
}
