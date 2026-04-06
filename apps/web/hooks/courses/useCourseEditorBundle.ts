'use client';

import type { CourseEditorBundle } from '@services/courses/editor';
import { getCourseEditorBundle } from '@services/courses/editor';
import { courseKeys } from './courseKeys';
import useSWR from 'swr';

export function useCourseEditorBundle(courseUuid?: string | null) {
  const key = courseUuid ? courseKeys.editorBundle(courseUuid) : null;

  const swr = useSWR<CourseEditorBundle>(
    key,
    () => {
      if (!courseUuid) {
        throw new Error('Course UUID is missing');
      }
      return getCourseEditorBundle(courseUuid);
    },
    {
      revalidateOnFocus: false,
    },
  );

  return {
    ...swr,
    editorData: swr.data,
    key,
  };
}
