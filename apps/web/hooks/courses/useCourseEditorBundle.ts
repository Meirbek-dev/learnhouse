'use client';

import { getCourseEditorBundle, type CourseEditorBundle } from '@services/courses/editor';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { courseKeys } from './courseKeys';
import useSWR from 'swr';

export function useCourseEditorBundle(courseUuid?: string | null) {
  const session = usePlatformSession();
  const accessToken = session?.data?.tokens?.access_token ?? null;
  const key = courseKeys.editorBundle(courseUuid, accessToken);

  const swr = useSWR<CourseEditorBundle>(key, () => getCourseEditorBundle(courseUuid!, accessToken!), {
    revalidateOnFocus: false,
  });

  return {
    ...swr,
    editorData: swr.data,
    key,
  };
}
