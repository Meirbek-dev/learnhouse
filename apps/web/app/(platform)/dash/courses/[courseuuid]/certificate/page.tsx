import EditCourseCertification from '@components/Dashboard/Pages/Course/EditCourseCertification/EditCourseCertification';
import { renderCourseWorkspacePage } from '@components/Dashboard/Courses/renderCourseWorkspacePage';
import { PLATFORM_ORG_SLUG } from '@/services/config/config';

export default async function PlatformCourseCertificatePage(props: { params: Promise<{ courseuuid: string }> }) {
  const { courseuuid } = await props.params;

  return renderCourseWorkspacePage({
    orgslug: PLATFORM_ORG_SLUG,
    courseuuid,
    activeStage: 'certificate',
    children: <EditCourseCertification orgslug={PLATFORM_ORG_SLUG} />,
  });
}
