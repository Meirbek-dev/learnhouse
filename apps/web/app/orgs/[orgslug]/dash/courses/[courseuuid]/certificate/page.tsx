import EditCourseCertification from '@components/Dashboard/Pages/Course/EditCourseCertification/EditCourseCertification';
import { renderCourseWorkspacePage } from '@components/Dashboard/Courses/renderCourseWorkspacePage';

async function CourseCertificatePage(props: { params: Promise<{ orgslug: string; courseuuid: string }> }) {
  const { orgslug, courseuuid } = await props.params;

  return renderCourseWorkspacePage({
    orgslug,
    courseuuid,
    activeStage: 'certificate',
    children: <EditCourseCertification orgslug={orgslug} />,
  });
}

export default CourseCertificatePage;
