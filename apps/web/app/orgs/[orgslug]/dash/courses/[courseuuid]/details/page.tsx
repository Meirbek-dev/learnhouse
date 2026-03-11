import EditCourseGeneral from '@components/Dashboard/Pages/Course/EditCourseGeneral/EditCourseGeneral';
import { renderCourseWorkspacePage } from '@components/Dashboard/Courses/renderCourseWorkspacePage';

async function CourseDetailsPage(props: { params: Promise<{ orgslug: string; courseuuid: string }> }) {
  const { orgslug, courseuuid } = await props.params;

  return renderCourseWorkspacePage({
    orgslug,
    courseuuid,
    activeStage: 'details',
    children: <EditCourseGeneral orgslug={orgslug} />,
  });
}

export default CourseDetailsPage;
