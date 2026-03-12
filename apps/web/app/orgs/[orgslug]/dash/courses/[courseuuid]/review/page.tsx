import { renderCourseWorkspacePage } from '@components/Dashboard/Courses/renderCourseWorkspacePage';
import CourseReviewPublish from '@components/Dashboard/Courses/CourseReviewPublish';
import { requireCourseWorkspaceStageAccess } from '@/lib/course-management-server';

async function CourseReviewPage(props: { params: Promise<{ orgslug: string; courseuuid: string }> }) {
  const { orgslug, courseuuid } = await props.params;
  const capabilities = await requireCourseWorkspaceStageAccess(orgslug, courseuuid, 'review');

  return renderCourseWorkspacePage({
    orgslug,
    courseuuid,
    activeStage: 'review',
    capabilities,
    children: (
      <CourseReviewPublish
        orgslug={orgslug}
        courseuuid={courseuuid}
        capabilities={capabilities}
      />
    ),
  });
}

export default CourseReviewPage;
