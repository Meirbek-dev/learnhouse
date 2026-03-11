import CourseCreationWizard from '@components/Dashboard/Courses/CourseCreationWizard';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { getEditableOrgCourses } from '@services/courses/courses';
import { auth } from '@/auth';

async function NewCoursePage(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params;
  const session = await auth();
  const accessToken = session?.tokens?.access_token;
  const [org, { courses }] = await Promise.all([
    getOrganizationContextInfo(orgslug, null, accessToken || undefined),
    getEditableOrgCourses(orgslug, accessToken || undefined, 1, 100, '', 'updated'),
  ]);

  return (
    <CourseCreationWizard
      orgslug={orgslug}
      orgId={org.id}
      sourceCourses={courses.map((course: any) => ({
        course_uuid: course.course_uuid,
        name: course.name,
        description: course.description,
      }))}
    />
  );
}

export default NewCoursePage;
