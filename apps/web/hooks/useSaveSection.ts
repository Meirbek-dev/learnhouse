'use client';

import { useCourse } from '@components/Contexts/CourseContext';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

interface SaveSectionOptions {
  /** Called after a successful save to reset dirty state. */
  onSuccess?: () => void;
}

/**
 * Centralised save handler for course workspace sections.
 *
 * Wraps the common pattern of:
 *  - setting isSaving state
 *  - calling the API
 *  - handling 409 conflict via CourseContext.showConflict
 *  - showing a toast on success or error
 *  - calling onSuccess (e.g. markClean)
 *  - refreshing SWR via refreshCourseMeta (single source of truth — no optimistic dispatch)
 */
export function useSaveSection(options?: SaveSectionOptions) {
  const [isSaving, setIsSaving] = useState(false);
  const { showConflict, refreshCourseMeta, refreshCourseEditor } = useCourse();

  const save = useCallback(
    async (saveFn: () => Promise<{ success: boolean; status?: number; data?: any }>) => {
      setIsSaving(true);
      try {
        const response = await saveFn();

        if (!response.success) {
          if (response.status === 409) {
            const detail = response.data?.detail;
            showConflict(typeof detail === 'string' ? detail : undefined);
            return;
          }
          const message =
            typeof response.data?.detail === 'string' ? response.data.detail : 'Failed to save. Please try again.'; // i18n:TODO
          toast.error(message);
          return;
        }

        // Refresh SWR — the CourseContext useEffect will pick up fresh data.
        // Do NOT also dispatch setCourseStructure optimistically (causes double-update).
        await refreshCourseMeta();
        toast.success('Changes saved'); // i18n:TODO
        options?.onSuccess?.();
      } catch (error: any) {
        if (error?.status === 409) {
          showConflict(error?.detail || error?.message);
          return;
        }
        toast.error(error?.message || 'Failed to save. Please try again.'); // i18n:TODO
      } finally {
        setIsSaving(false);
      }
    },
    [showConflict, refreshCourseMeta, options],
  );

  const saveWithEditorRefresh = useCallback(
    async (saveFn: () => Promise<{ success: boolean; status?: number; data?: any }>) => {
      setIsSaving(true);
      try {
        const response = await saveFn();

        if (!response.success) {
          if (response.status === 409) {
            const detail = response.data?.detail;
            showConflict(typeof detail === 'string' ? detail : undefined);
            return;
          }
          const message =
            typeof response.data?.detail === 'string' ? response.data.detail : 'Failed to save. Please try again.'; // i18n:TODO
          toast.error(message);
          return;
        }

        await refreshCourseEditor();
        toast.success('Changes saved'); // i18n:TODO
        options?.onSuccess?.();
      } catch (error: any) {
        if (error?.status === 409) {
          showConflict(error?.detail || error?.message);
          return;
        }
        toast.error(error?.message || 'Failed to save. Please try again.'); // i18n:TODO
      } finally {
        setIsSaving(false);
      }
    },
    [showConflict, refreshCourseEditor, options],
  );

  return { isSaving, save, saveWithEditorRefresh };
}
