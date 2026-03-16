import EditCourseContributors from '@components/Dashboard/Pages/Course/EditCourseContributors/EditCourseContributors';
import { renderCourseWorkspacePage } from '@components/Dashboard/Courses/renderCourseWorkspacePage';
import { PLATFORM_ORG_SLUG } from '@/services/config/config';

export default async function PlatformCourseCollaborationPage(props: { params: Promise<{ courseuuid: string }> }) {
  const { courseuuid } = await props.params;

  return renderCourseWorkspacePage({
    courseuuid,
    activeStage: 'collaboration',
    children: <EditCourseContributors orgslug={PLATFORM_ORG_SLUG} />,
  });
}
