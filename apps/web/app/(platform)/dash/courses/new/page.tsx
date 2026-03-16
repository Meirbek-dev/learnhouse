import CourseCreationWizard from '@components/Dashboard/Courses/CourseCreationWizard';
import { getPlatformOrganizationContextInfo } from '@services/organizations/orgs';
import { getEditableOrgCourses } from '@services/courses/courses';
import { PLATFORM_ORG_SLUG } from '@/services/config/config';
import { auth } from '@/auth';

export default async function PlatformNewCoursePage() {
  const session = await auth();
  const accessToken = session?.tokens?.access_token;
  const [org, initialCourses] = await Promise.all([
    getPlatformOrganizationContextInfo(accessToken || undefined),
    getEditableOrgCourses(PLATFORM_ORG_SLUG, accessToken || undefined, 1, 1, '', 'updated'),
  ]);
  const totalSourceCourses = Math.max(initialCourses.total, initialCourses.courses.length);
  const sourceCourseResponse =
    totalSourceCourses <= initialCourses.courses.length
      ? initialCourses
      : await getEditableOrgCourses(PLATFORM_ORG_SLUG, accessToken || undefined, 1, totalSourceCourses, '', 'updated');

  return (
    <CourseCreationWizard
      orgslug={PLATFORM_ORG_SLUG}
      orgId={org.id}
      sourceCourses={sourceCourseResponse.courses.map((course: any) => ({
        course_uuid: course.course_uuid,
        name: course.name,
        description: course.description,
      }))}
    />
  );
}
