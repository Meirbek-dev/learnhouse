import { getCourseMetadata } from '@services/courses/courses';
import { auth } from '@/auth';

import CourseOverviewClientPage from './page-client';

export interface CourseOverviewParams {
  orgslug: string;
  courseuuid: string;
  subpage: string;
}

async function CourseOverviewPage(props: { params: Promise<CourseOverviewParams> }) {
  const params = await props.params;
  const session = await auth();
  const accessToken = session?.tokens?.access_token;
  const initialCourse = await getCourseMetadata(params.courseuuid, null, accessToken, true);

  return (
    <CourseOverviewClientPage
      params={params}
      initialCourse={initialCourse}
    />
  );
}

export default CourseOverviewPage;
