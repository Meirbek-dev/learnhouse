import EditCourseStructure from '@components/Dashboard/Pages/Course/EditCourseStructure/EditCourseStructure';
import { renderCourseWorkspacePage } from '@components/Dashboard/Courses/renderCourseWorkspacePage';

async function CourseCurriculumPage(props: { params: Promise<{ orgslug: string; courseuuid: string }> }) {
  const { orgslug, courseuuid } = await props.params;

  return renderCourseWorkspacePage({
    orgslug,
    courseuuid,
    activeStage: 'curriculum',
    children: <EditCourseStructure orgslug={orgslug} />,
  });
}

export default CourseCurriculumPage;
