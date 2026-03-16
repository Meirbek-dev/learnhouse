import EditCourseGeneral from '@components/Dashboard/Pages/Course/EditCourseGeneral/EditCourseGeneral';
import { renderCourseWorkspacePage } from '@components/Dashboard/Courses/renderCourseWorkspacePage';
import { PLATFORM_ORG_SLUG } from '@/services/config/config';

export default async function PlatformCourseDetailsPage(props: { params: Promise<{ courseuuid: string }> }) {
  const { courseuuid } = await props.params;

  return renderCourseWorkspacePage({
    orgslug: PLATFORM_ORG_SLUG,
    courseuuid,
    activeStage: 'details',
    children: <EditCourseGeneral orgslug={PLATFORM_ORG_SLUG} />,
  });
}
