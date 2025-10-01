'use client';

import CourseThumbnail from '@components/Objects/Thumbnails/CourseThumbnail';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import useSWR from 'swr';

interface CourseGridClientProps {
  courses: any[];
  orgslug: string;
}

export default function CourseGridClient({ courses, orgslug }: CourseGridClientProps) {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;

  // Fetch trail data to show progress on course thumbnails
  const { data: trailData } = useSWR(
    org?.id && access_token ? `${getAPIUrl()}trail/org/${org.id}/trail` : null,
    (url) => swrFetcher(url, access_token),
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
