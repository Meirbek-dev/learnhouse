import EditCourseStructure from '@components/Dashboard/Pages/Course/EditCourseStructure/EditCourseStructure';
import { renderCourseWorkspacePage } from '@components/Dashboard/Courses/renderCourseWorkspacePage';
import { PLATFORM_ORG_SLUG } from '@/services/config/config';

export default async function PlatformCourseCurriculumPage(props: { params: Promise<{ courseuuid: string }> }) {
  const { courseuuid } = await props.params;

  return renderCourseWorkspacePage({
    courseuuid,
    activeStage: 'curriculum',
    children: <EditCourseStructure orgslug={PLATFORM_ORG_SLUG} />,
  });
}
