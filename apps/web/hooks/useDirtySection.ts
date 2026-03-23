'use client';

import type { CourseSectionKey } from '@components/Contexts/CourseContext';
import { useCourseEditorStore } from '@/stores/courses';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Shared dirty-state tracking hook for course workspace edit sections.
 *
 * Centralises the isDirty / isDirtyRef / initialRef / context-sync boilerplate
 * that was previously copy-pasted across EditCourseGeneral, EditCourseAccess,
 * EditCourseContributors, and EditCourseCertification.
 */
export function useDirtySection(sectionKey: CourseSectionKey) {
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);
  const setSectionDirty = useCourseEditorStore((state) => state.setSectionDirty);

  useEffect(() => {
    setSectionDirty(sectionKey, isDirty);
  }, [isDirty, sectionKey, setSectionDirty]);

  useEffect(() => {
    return () => {
      setSectionDirty(sectionKey, false);
    };
  }, [sectionKey, setSectionDirty]);

  const markDirty = useCallback(() => {
    isDirtyRef.current = true;
    setIsDirty(true);
  }, []);

  const markClean = useCallback(() => {
    isDirtyRef.current = false;
    setIsDirty(false);
  }, []);

  return { isDirty, isDirtyRef, markDirty, markClean };
}
