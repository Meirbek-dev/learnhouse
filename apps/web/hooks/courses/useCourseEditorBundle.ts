'use client';

import { useQuery } from '@tanstack/react-query';
import { getCourseEditorBundle } from '@services/courses/editor';
import { courseKeys } from './courseKeys';

export function useCourseEditorBundle(courseUuid?: string | null) {
  const key = courseUuid ? courseKeys.editorBundle(courseUuid) : null;

  const query = useQuery({
    queryKey: key ?? ['courses', 'editor-bundle', 'missing'],
    queryFn: () => {
      if (!courseUuid) {
        throw new Error('Course UUID is missing');
      }
      return getCourseEditorBundle(courseUuid);
    },
    enabled: Boolean(courseUuid),
  });

  return {
    ...query,
    editorData: query.data,
    isLoading: query.isPending,
    key,
  };
}
