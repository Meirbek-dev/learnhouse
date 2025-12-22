'use client';

import { AlertCircle, BookOpen, FileText, GalleryVerticalEnd, Layers2, UserPen } from 'lucide-react';

import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { getAssignmentsFromACourse } from '@services/courses/assignments';
import { getCourseThumbnailMediaDirectory } from '@services/media/media';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getAPIUrl, getUriWithOrg } from '@services/config/config';
import BreadCrumbs from '@components/Dashboard/Misc/BreadCrumbs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useOrg } from '@components/Contexts/OrgContext';
import { swrFetcher } from '@services/utils/ts/requests';
import { buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import useSWR from 'swr';

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

const AssignmentsHome = () => {
  const t = useTranslations('DashPage.Assignments.HomePage');
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const org = useOrg() as any;
  const [courseAssignments, setCourseAssignments] = useState<Assignment[][]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);

  const { data: courses, isLoading: isLoadingCourses } = useSWR(
    access_token ? `${getAPIUrl()}courses/org_slug/${org?.slug}/page/1/limit/128` : null,
    (url) => swrFetcher(url, access_token),
  );

  const removePrefix = (str: string, prefix: string) => str.replace(prefix, '');

  useEffect(() => {
    if (!courses || !access_token) return;

    setIsLoadingAssignments(true);
    const fetchAssignments = async () => {
      try {
        const results = await Promise.all(
          courses.map(async (course: Course) => {
            const res = await getAssignmentsFromACourse(course.course_uuid, access_token);
            return res.data || [];
          }),
        );
        setCourseAssignments(results);
      } catch (error) {
        console.error('Failed to fetch assignments:', error);
        setCourseAssignments([]);
      } finally {
        setIsLoadingAssignments(false);
      }
    };

    fetchAssignments();
  }, [courses, access_token]);

  if (isLoadingCourses) {
    return <LoadingState />;
  }

  return (
    <div className="flex min-h-screen w-full">
      <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 space-y-2">
          <BreadCrumbs type="assignments" />
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('assignments')}</h1>
        </div>

        {isLoadingAssignments ? (
          <LoadingState />
        ) : courses?.length === 0 ? (
          <EmptyState message={t('noCourses')} />
        ) : (
          <div className="space-y-6">
            {courses?.map((course: Course, index: number) => (
              <CourseCard
                key={course.course_uuid}
                course={course}
                assignments={courseAssignments[index] || []}
                org={org}
                t={t}
                removePrefix={removePrefix}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const CourseCard = ({ course, assignments, org, t, removePrefix }: any) => {
  const courseId = removePrefix(course.course_uuid, 'course_');

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <CourseThumbnail
              course={course}
              org={org}
              courseId={courseId}
            />
            <div className="space-y-1">
              <Badge
                variant="secondary"
                className="mb-1"
              >
                <BookOpen className="mr-1 h-3 w-3" />
                {t('course')}
              </Badge>
              <h2 className="text-xl leading-tight font-semibold">{course.name}</h2>
            </div>
          </div>
          <Link
            prefetch={false}
            href={{
              pathname: getUriWithOrg(org.slug, `/dash/courses/course/${courseId}/content`),
              query: { subpage: 'editor' },
            }}
            className={cn(
              buttonVariants({ variant: 'default', size: 'sm' }),
              'w-full sm:w-auto inline-flex items-center justify-center',
            )}
          >
            <GalleryVerticalEnd className="mr-2 h-4 w-4" />
            {t('courseEditor')}
          </Link>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {assignments?.length > 0 ? (
          <div className="space-y-3">
            {assignments.map((assignment: Assignment, idx: number) => (
              <div key={assignment.assignment_uuid}>
                <AssignmentRow
                  assignment={assignment}
                  org={org}
                  t={t}
                  removePrefix={removePrefix}
                />
                {idx < assignments.length - 1 && <Separator className="mt-3" />}
              </div>
            ))}
          </div>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="ml-2">{t('noAssignments')}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

const AssignmentRow = ({ assignment, org, t, removePrefix }: any) => {
  const assignmentId = removePrefix(assignment.assignment_uuid, 'assignment_');

  return (
    <div className="bg-card hover:bg-accent/50 flex flex-col gap-4 rounded-lg border p-5 transition-colors sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2 sm:flex-1">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="w-fit"
          >
            <FileText className="mr-1 h-3 w-3" />
            {t('assignment')}
          </Badge>
          <h3 className="text-base font-semibold">{assignment.title}</h3>
        </div>
        {assignment.description && (
          <p className="text-muted-foreground line-clamp-2 text-sm">{assignment.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Link
          prefetch={false}
          href={{
            pathname: getUriWithOrg(org.slug, `/dash/assignments/${assignmentId}`),
            query: { subpage: 'editor' },
          }}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'inline-flex items-center justify-center')}
        >
          <Layers2 className="mr-2 h-4 w-4" />
          {t('editor')}
        </Link>

        <Link
          prefetch={false}
          href={{
            pathname: getUriWithOrg(org.slug, `/dash/assignments/${assignmentId}`),
            query: { subpage: 'submissions' },
          }}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'inline-flex items-center justify-center')}
        >
          <UserPen className="mr-2 h-4 w-4" />
          {t('submissions')}
        </Link>
      </div>
    </div>
  );
};

const CourseThumbnail = ({ course, org, courseId }: any) => {
  const thumbnailUrl = course.thumbnail_image
    ? getCourseThumbnailMediaDirectory(org?.org_uuid, course.course_uuid, course.thumbnail_image)
    : '/empty_thumbnail.webp';

  return (
    <Link
      prefetch={false}
      href={getUriWithOrg(org.slug, `/course/${courseId}`)}
      className="group relative shrink-0"
      aria-label={`View ${course.name} course`}
    >
      <div
        role="img"
        aria-hidden="true"
        className="h-20 w-32 overflow-hidden rounded-lg bg-cover bg-center shadow-md ring-1 ring-black/5 transition-all group-hover:shadow-lg group-hover:ring-black/10"
        style={{
          backgroundImage: `url(${thumbnailUrl})`,
          backgroundSize: course.thumbnail_image ? 'cover' : 'contain',
        }}
      />
    </Link>
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
