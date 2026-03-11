import { buildCourseWorkspacePath, mapLegacyCourseStage } from '@/lib/course-management';
import { redirect } from 'next/navigation';

export interface CourseOverviewParams {
  orgslug: string;
  courseuuid: string;
  subpage: string;
}

async function CourseOverviewPage(props: { params: Promise<CourseOverviewParams> }) {
  const params = await props.params;
  redirect(buildCourseWorkspacePath(params.orgslug, params.courseuuid, mapLegacyCourseStage(params.subpage)));
}

export default CourseOverviewPage;
