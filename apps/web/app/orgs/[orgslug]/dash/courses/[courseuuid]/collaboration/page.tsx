import EditCourseContributors from '@components/Dashboard/Pages/Course/EditCourseContributors/EditCourseContributors';
import { renderCourseWorkspacePage } from '@components/Dashboard/Courses/renderCourseWorkspacePage';

async function CourseCollaborationPage(props: { params: Promise<{ orgslug: string; courseuuid: string }> }) {
  const { orgslug, courseuuid } = await props.params;

  return renderCourseWorkspacePage({
    orgslug,
    courseuuid,
    activeStage: 'collaboration',
    children: <EditCourseContributors orgslug={orgslug} />,
  });
}

export default CourseCollaborationPage;
