import { renderCourseWorkspacePage } from '@components/Dashboard/Courses/renderCourseWorkspacePage';
import { getCourseWorkspaceCapabilitiesForOrg } from '@/lib/course-management-server';
import CourseReviewPublish from '@components/Dashboard/Courses/CourseReviewPublish';

async function CourseReviewPage(props: { params: Promise<{ orgslug: string; courseuuid: string }> }) {
  const { orgslug, courseuuid } = await props.params;
  const capabilities = await getCourseWorkspaceCapabilitiesForOrg(orgslug);

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
