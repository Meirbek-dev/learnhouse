'use client';

import { usePlatformSession } from '@/components/Contexts/SessionContext';
import type { CourseEditorBundle } from '@services/courses/editor';
import { getCourseEditorBundle } from '@services/courses/editor';
import { courseKeys } from './courseKeys';
import { useEffect, useRef } from 'react';
import useSWR from 'swr';

/**
 * Fetches the course editor bundle (contributors, certifications, linked user groups).
 *
 * The auth token is NOT in the SWR key to avoid cache pollution on token refresh.
 * Instead it is captured in a ref and read at fetch time.  When the token changes
 * (login / logout / rotation), a `mutate(key)` call in SWRTokenProvider triggers
 * a fresh fetch that picks up the latest token from the ref.
 */
export function useCourseEditorBundle(courseUuid?: string | null) {
  const session = usePlatformSession();
  const accessToken = session?.data?.tokens?.access_token ?? null;

  // Always read the latest token at fetch time without making it a key dependency.
  const accessTokenRef = useRef(accessToken);
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  const key = courseKeys.editorBundle(courseUuid);

  const swr = useSWR<CourseEditorBundle>(key, () => getCourseEditorBundle(courseUuid!, accessTokenRef.current!), {
    revalidateOnFocus: false,
  });

  return {
    ...swr,
    editorData: swr.data,
    key,
  };
}
