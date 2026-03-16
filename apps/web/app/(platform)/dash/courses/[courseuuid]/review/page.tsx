import { renderCourseWorkspacePage } from '@components/Dashboard/Courses/renderCourseWorkspacePage';
import CourseReviewPublish from '@components/Dashboard/Courses/CourseReviewPublish';
import { requireCourseWorkspaceStageAccess } from '@/lib/course-management-server';
import { PLATFORM_ORG_SLUG } from '@/services/config/config';

export default async function PlatformCourseReviewPage(props: { params: Promise<{ courseuuid: string }> }) {
  const { courseuuid } = await props.params;
  const capabilities = await requireCourseWorkspaceStageAccess(PLATFORM_ORG_SLUG, courseuuid, 'review');

  return renderCourseWorkspacePage({
    orgslug: PLATFORM_ORG_SLUG,
    courseuuid,
    activeStage: 'review',
    capabilities,
    children: (
      <CourseReviewPublish
        orgslug={PLATFORM_ORG_SLUG}
        courseuuid={courseuuid}
        capabilities={capabilities}
      />
    ),
  });
}
