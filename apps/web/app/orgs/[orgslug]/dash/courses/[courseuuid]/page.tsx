import { renderCourseWorkspacePage } from '@components/Dashboard/Courses/renderCourseWorkspacePage';
import CourseWorkspaceOverview from '@components/Dashboard/Courses/CourseWorkspaceOverview';
import { getCourseWorkspaceCapabilitiesForOrg } from '@/lib/course-management-server';

async function CourseWorkspaceOverviewPage(props: { params: Promise<{ orgslug: string; courseuuid: string }> }) {
  const { orgslug, courseuuid } = await props.params;
  const capabilities = await getCourseWorkspaceCapabilitiesForOrg(orgslug);

  return renderCourseWorkspacePage({
    orgslug,
    courseuuid,
    activeStage: 'overview',
    capabilities,
    children: (
      <CourseWorkspaceOverview
        orgslug={orgslug}
        courseuuid={courseuuid}
        capabilities={capabilities}
      />
    ),
  });
}

export default CourseWorkspaceOverviewPage;
