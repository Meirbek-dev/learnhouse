import EditCourseAccess from '@components/Dashboard/Pages/Course/EditCourseAccess/EditCourseAccess';
import { renderCourseWorkspacePage } from '@components/Dashboard/Courses/renderCourseWorkspacePage';

async function CourseAccessPage(props: { params: Promise<{ orgslug: string; courseuuid: string }> }) {
  const { orgslug, courseuuid } = await props.params;

  return renderCourseWorkspacePage({
    orgslug,
    courseuuid,
    activeStage: 'access',
    children: <EditCourseAccess orgslug={orgslug} />,
  });
}

export default CourseAccessPage;
