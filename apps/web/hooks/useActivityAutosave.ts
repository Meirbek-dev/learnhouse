'use client';

import { useActivityMutations } from '@/hooks/mutations/useActivityMutations';
import { useDebouncedCallback } from '@/hooks/useDebounce';
import { useCourseEditorStore } from '@/stores/courses';
import { useCallback, useRef } from 'react';

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
  const setConflict = useCourseEditorStore((state) => state.setConflict);
  const setActivitySaveStatus = useCourseEditorStore((state) => state.setActivitySaveStatus);

  // Track the latest payload locally for draftSnapshot on 409
  const latestPayloadRef = useRef<any>(null);

  const persistDraft = useCallback(
    async (payload: any) => {
      setActivitySaveStatus('saving');

      try {
        await updateActivity(options.activityUuid, payload, {
          accessToken: options.accessToken,
          lastKnownUpdateDate: useCourseEditorStore.getState().lastKnownUpdateDate ?? options.lastKnownUpdateDate,
        });
        setActivitySaveStatus('saved');
      } catch (error: any) {
        setActivitySaveStatus('error');
        if (error?.status === 409) {
          setConflict({
            message: error?.detail || error?.message,
            section: 'content',
            draftSnapshot: latestPayloadRef.current,
            pendingSave: async () => {
              await updateActivity(options.activityUuid, payload, {
                accessToken: options.accessToken,
                lastKnownUpdateDate: useCourseEditorStore.getState().lastKnownUpdateDate,
              });
              setActivitySaveStatus('saved');
            },
          });
        }
        throw error;
      }
    },
    [
      options.accessToken,
      options.activityUuid,
      options.lastKnownUpdateDate,
      setActivitySaveStatus,
      setConflict,
      updateActivity,
    ],
  );

  const debouncedSave = useDebouncedCallback((payload: any) => {
    void persistDraft(payload);
  }, options.delay ?? 1500);

  const onChange = useCallback(
    (payload: any) => {
      latestPayloadRef.current = payload;
      setActivitySaveStatus('saving');
      debouncedSave(payload);
    },
    [debouncedSave, setActivitySaveStatus],
  );

  const flush = useCallback(
    async (payload: any) => {
      latestPayloadRef.current = payload;
      await persistDraft(payload);
    },
    [persistDraft],
  );

  return {
    flush,
    onChange,
    lastSavedAt: lastActivitySavedAt,
    saveStatus: activitySaveStatus,
  };
}
