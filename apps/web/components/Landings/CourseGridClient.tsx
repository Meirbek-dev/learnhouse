'use client';

import CourseThumbnail from '@components/Objects/Thumbnails/CourseThumbnail';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
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
  const { data: trailData } = useSWR(orgId && accessToken ? `${getAPIUrl()}trail/org/${orgId}/trail` : null, (url) =>
    swrFetcher(url, accessToken),
  );

  return (
    <div className="grid w-full grid-cols-1 gap-6 pb-12 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4">
      {courses.map((course: any) => (
        <div
          key={course.course_uuid}
          className="flex justify-center"
        >
          <CourseThumbnail
            course={course}
            orgslug={orgslug}
            trailData={trailData}
          />
        </div>
      ))}
    </div>
  );
}
