import EditCourseAccess from '@components/Dashboard/Pages/Course/EditCourseAccess/EditCourseAccess';
import { renderCourseWorkspacePage } from '@components/Dashboard/Courses/renderCourseWorkspacePage';
import { PLATFORM_ORG_SLUG } from '@/services/config/config';

export default async function PlatformCourseAccessPage(props: { params: Promise<{ courseuuid: string }> }) {
  const { courseuuid } = await props.params;

  return renderCourseWorkspacePage({
    orgslug: PLATFORM_ORG_SLUG,
    courseuuid,
    activeStage: 'access',
    children: <EditCourseAccess orgslug={PLATFORM_ORG_SLUG} />,
  });
}
