'use client';

import CourseThumbnail from '@components/Objects/Thumbnails/CourseThumbnail';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import { swrFetcher } from '@services/utils/ts/requests';
import { getTrailSwrKey } from '@services/courses/keys';
import useSWR from 'swr';

interface CourseGridClientProps {
  courses: any[];
  orgslug: string;
}

export default function CourseGridClient({ courses, orgslug }: CourseGridClientProps) {
  const session = usePlatformSession() as any;
  const org = useOrg() as any;
  const accessToken = session?.data?.tokens?.access_token;
  const orgId = org?.id;

  // Fetch trail data to show progress on course thumbnails
  // Dedupe and revalidate less frequently to reduce requests
  const TRAIL_KEY = orgId ? getTrailSwrKey(orgId) : null;
  const { data: trailData } = useSWR(
    orgId && accessToken && TRAIL_KEY ? [TRAIL_KEY, accessToken] : null,
    ([url, token]) => swrFetcher(url, token),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60_000, // 1 minute
    },
  );

  const isTrailLoading = Boolean(orgId && accessToken && !trailData);

  return (
    <div className="grid w-full grid-cols-1 justify-items-center gap-6 pb-12 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {courses.map((course: any) => (
        <div
          key={course.course_uuid}
          className="flex w-full max-w-sm justify-center"
        >
          <CourseThumbnail
            course={course}
            orgslug={orgslug}
            trailData={trailData}
            trailLoading={isTrailLoading}
          />
        </div>
      ))}

      {/* If trail is loading, render a few skeleton placeholders to indicate progress data is incoming */}
      {isTrailLoading &&
        courses.length > 0 &&
        Array.from({ length: Math.min(4, courses.length) }).map((_, i) => (
          <div
            key={`skeleton-${i}`}
            className="flex w-full max-w-sm justify-center"
          >
            <div className="w-full animate-pulse">
              <div className="bg-muted h-44 w-full rounded-md" />
              <div className="bg-muted mt-3 h-4 w-3/4 rounded" />
              <div className="bg-muted mt-2 h-3 w-1/2 rounded" />
            </div>
          </div>
        ))}
    </div>
  );
}
