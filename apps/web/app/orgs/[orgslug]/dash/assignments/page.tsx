import { FileText } from 'lucide-react';

import { getAssignmentsFromCourses } from '@services/courses/assignments';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import BreadCrumbs from '@components/Dashboard/Misc/BreadCrumbs';
import { getEditableOrgCourses } from '@services/courses/courses';
import { Card, CardContent } from '@/components/ui/card';
import { getTranslations } from 'next-intl/server';
import { Spinner } from '@components/ui/spinner';
import { CourseCard } from './ClientParts';
import { auth } from '@/auth';

interface Course {
  course_uuid: string;
  name: string;
  thumbnail_image?: string;
}

interface Assignment {
  assignment_uuid: string;
  title: string;
  description: string;
}

const AssignmentsHome = async (params: any) => {
  const { orgslug } = await params.params;
  const t = await getTranslations('DashPage.Assignments.HomePage');

  const session = await auth();
  const access_token = session?.tokens?.access_token;

  if (!access_token) {
    return;
  }
  const org = await getOrganizationContextInfo(orgslug, undefined, access_token);

  const coursesData = await getEditableOrgCourses(orgslug, access_token);
  const courses = coursesData?.courses || [];

  // Fetch assignments in one batched request
  let courseAssignments: Assignment[][] = [];
  if (courses.length > 0) {
    const res = await getAssignmentsFromCourses(
      courses.map((c: Course) => c.course_uuid),
      access_token,
    );
    // If the batched endpoint succeeded and returned a mapping, use it.

    const assignmentsMap = res.data as Record<string, Assignment[]>;
    courseAssignments = courses.map((course: Course) => assignmentsMap[course.course_uuid] || []);
  }

  return (
    <div className="flex min-h-screen w-full">
      <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 space-y-2">
          <BreadCrumbs type="assignments" />
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('assignments')}</h1>
        </div>

        {courses?.length === 0 ? (
          <EmptyState message={t('noCourses')} />
        ) : (
          <div className="space-y-6">
            {courses?.map((course: Course, index: number) => (
              <CourseCard
                key={course.course_uuid}
                course={course}
                assignments={courseAssignments[index] || []}
                org={org}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const LoadingState = () => (
  <div className="flex min-h-[400px] items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <Spinner className="size-8" />
    </div>
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <Card className="border-dashed">
    <CardContent className="flex min-h-[400px] flex-col items-center justify-center gap-3 py-12">
      <div className="bg-muted rounded-full p-4">
        <FileText className="text-muted-foreground h-8 w-8" />
      </div>
      <p className="text-muted-foreground text-center text-lg font-medium">{message}</p>
    </CardContent>
  </Card>
);

export default AssignmentsHome;
