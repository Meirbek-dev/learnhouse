import CourseCreationWizard from '@components/Dashboard/Courses/CourseCreationWizard';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { getEditableOrgCourses } from '@services/courses/courses';
import { auth } from '@/auth';

async function NewCoursePage(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params;
  const session = await auth();
  const accessToken = session?.tokens?.access_token;
  const [org, initialCourses] = await Promise.all([
    getOrganizationContextInfo(orgslug, null, accessToken || undefined),
    getEditableOrgCourses(orgslug, accessToken || undefined, 1, 1, '', 'updated'),
  ]);
  const totalSourceCourses = Math.max(initialCourses.total, initialCourses.courses.length);
  const sourceCourseResponse =
    totalSourceCourses <= initialCourses.courses.length
      ? initialCourses
      : await getEditableOrgCourses(orgslug, accessToken || undefined, 1, totalSourceCourses, '', 'updated');

  return (
    <CourseCreationWizard
      orgslug={orgslug}
      orgId={org.id}
      sourceCourses={sourceCourseResponse.courses.map((course: any) => ({
        course_uuid: course.course_uuid,
        name: course.name,
        description: course.description,
      }))}
    />
  );
}

export default NewCoursePage;
