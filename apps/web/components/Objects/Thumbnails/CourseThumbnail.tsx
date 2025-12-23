'use client';

import { Play, Calendar, MoreVertical, FilePenLine, Settings2, BookMinus, AlertTriangle, Loader2 } from 'lucide-react';
import { useState, useTransition, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { FC } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@components/ui/dropdown-menu';
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { Card, CardContent, CardFooter } from '@components/ui/card';
import { useOrg } from '@components/Contexts/OrgContext';
import UserAvatar from '@components/Objects/UserAvatar';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import Link from '@components/ui/AppLink';

import { getCourseThumbnailMediaDirectory, getUserAvatarMediaDirectory } from '@services/media/media';
import { deleteCourseFromBackend } from '@services/courses/courses';
import { revalidateTags } from '@services/utils/ts/requests';
import { getUriWithOrg } from '@services/config/config';

// ============================================================================
// Types
// ============================================================================

export interface CourseAuthor {
  user: {
    id: number;
    user_uuid: string;
    avatar_image: string;
    first_name: string;
    middle_name?: string;
    last_name: string;
    username: string;
  };
  authorship: 'CREATOR' | 'CONTRIBUTOR' | 'MAINTAINER' | 'REPORTER';
  authorship_status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
}

export interface Course {
  course_uuid: string;
  name: string;
  description: string;
  thumbnail_image: string;
  org_id: number;
  update_date: string;
  authors?: CourseAuthor[];
  chapters?: {
    activities: any[];
  }[];
}

export interface CourseThumbnailProps {
  course: Course;
  orgslug: string;
  customLink?: string;
  trailData?: any;
  trailLoading?: boolean;
}

// ============================================================================
// Utilities
// ============================================================================

const removeCoursePrefix = (courseUuid: string): string => courseUuid.replace('course_', '');

const getAuthorFullName = (author: CourseAuthor['user']): string =>
  [author.first_name, author.middle_name, author.last_name].filter(Boolean).join(' ');

const formatDate = (dateString: string, locale: string): string => {
  try {
    return new Date(dateString).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
};

// ============================================================================
// Sub-components
// ============================================================================

interface CourseImageProps {
  thumbnailUrl: string;
  courseName: string;
  updateDate: string;
  locale: string;
  courseUrl: string;
  t: any;
}

const CourseImage: FC<CourseImageProps> = ({ thumbnailUrl, courseName, updateDate, locale, courseUrl, t }) => (
  <Link
    prefetch={false}
    href={courseUrl}
    className="relative block overflow-hidden"
    aria-label={t('openCourse', { course: courseName })}
  >
    <div className="bg-muted relative aspect-video w-full overflow-hidden">
      <img
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        src={thumbnailUrl}
        alt={courseName}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
      />

      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-50"
        aria-hidden="true"
      />

      {updateDate && (
        <Badge
          variant="secondary"
          className="bg-background/90 absolute right-2 bottom-2 text-xs backdrop-blur-sm"
        >
          <Calendar className="mr-1 h-3 w-3" />
          {formatDate(updateDate, locale)}
        </Badge>
      )}
    </div>
  </Link>
);

interface AuthorsDisplayProps {
  authors: CourseAuthor[];
  t: any;
}

const AuthorsDisplay: FC<AuthorsDisplayProps> = ({ authors, t }) => {
  const displayedAuthors = authors.slice(0, 3);
  const hasMoreAuthors = authors.length > 3;
  const remainingCount = authors.length - 3;

  const authorsText = useMemo(() => {
    const hasAllNames = displayedAuthors.every((a) => a.user.first_name && a.user.last_name);

    if (!hasAllNames) {
      return t('authorLabel', { count: authors.length });
    }

    const names = displayedAuthors.map((a) => getAuthorFullName(a.user)).join(', ');
    return hasMoreAuthors ? `${names} +${remainingCount}` : names;
  }, [displayedAuthors, hasMoreAuthors, remainingCount, authors.length, t]);

  if (authors.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center -space-x-2">
        {displayedAuthors.map((author, idx) => (
          <div
            key={author.user.user_uuid}
            className="relative transition-transform hover:z-20 hover:scale-110"
            style={{ zIndex: displayedAuthors.length - idx }}
          >
            <UserAvatar
              size="sm"
              variant="outline"
              avatar_url={
                author.user.avatar_image
                  ? getUserAvatarMediaDirectory(author.user.user_uuid, author.user.avatar_image)
                  : ''
              }
              predefined_avatar={author.user.avatar_image ? undefined : 'empty'}
              showProfilePopup
              userId={author.user.id}
            />
          </div>
        ))}
        {hasMoreAuthors && (
          <div className="border-background bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium">
            +{remainingCount}
          </div>
        )}
      </div>
      <span
        className="text-muted-foreground truncate text-xs"
        aria-label={authorsText}
      >
        {authorsText}
      </span>
    </div>
  );
};

interface ProgressBarProps {
  percentage: number;
  courseName: string;
  t: any;
}

const ProgressBar: FC<ProgressBarProps> = ({ percentage, courseName, t }) => (
  <div className="flex items-center gap-2">
    <div
      className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
      aria-label={t('progressBarAria', { course: courseName })}
    >
      <div
        className="bg-primary h-full transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
    <span className="text-muted-foreground w-10 text-right text-xs">{percentage}%</span>
  </div>
);

interface LoadingProgressBarProps {
  courseName: string;
  t: any;
}

const LoadingProgressBar: FC<LoadingProgressBarProps> = ({ courseName, t }) => (
  <div className="flex items-center gap-2">
    <div
      className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full"
      role="progressbar"
      aria-busy="true"
      aria-label={t('progressLoading', {
        course: courseName,
        defaultValue: 'Loading progress…',
      })}
    >
      <div className="bg-muted/70 h-full w-3/5 animate-pulse" />
    </div>
    <span className="text-muted-foreground w-10 text-right text-xs">—%</span>
  </div>
);

interface CourseActionsProps {
  isEnrolled: boolean;
  isLoading: boolean;
  progressPercentage: number;
  courseUrl: string;
  courseName: string;
  t: any;
}

const CourseActions: FC<CourseActionsProps> = ({
  isEnrolled,
  isLoading,
  progressPercentage,
  courseUrl,
  courseName,
  t,
}) => {
  if (isLoading) {
    return (
      <div className="w-full space-y-1.5">
        <LoadingProgressBar
          courseName={courseName}
          t={t}
        />
        <Button
          size="sm"
          className="w-full"
          disabled
          aria-disabled
        >
          <Play className="mr-2 h-4 w-4 opacity-60" />
          {t('loading', { defaultValue: 'Loading…' })}
        </Button>
      </div>
    );
  }

  if (isEnrolled) {
    return (
      <div className="w-full space-y-1.5">
        <ProgressBar
          percentage={progressPercentage}
          courseName={courseName}
          t={t}
        />
        <Button
          nativeButton={false}
          render={
            <Link
              prefetch={false}
              href={courseUrl}
            />
          }
          aria-label={t('continueLearning', { defaultValue: 'Continue Learning' })}
          size="sm"
          className="w-full"
        >
          <Play className="mr-2 h-4 w-4" />
          {t('continueLearning', { defaultValue: 'Continue Learning' })}
        </Button>
      </div>
    );
  }

  return (
    <Button
      nativeButton={false}
      render={
        <Link
          prefetch={false}
          href={courseUrl}
        />
      }
      aria-label={t('startLearning')}
      size="sm"
      className="w-full"
    >
      <Play className="mr-2 h-4 w-4" />
      {t('startLearning')}
    </Button>
  );
};

interface AdminMenuProps {
  course: Course;
  orgSlug: string;
  onDelete: () => Promise<void>;
}

const AdminMenu: FC<AdminMenuProps> = ({ course, orgSlug, onDelete }) => {
  const t = useTranslations('Components.CourseThumbnail');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      await onDelete();
      setIsDeleteDialogOpen(false);
    });
  };

  const courseIdClean = removeCoursePrefix(course.course_uuid);

  return (
    <AuthenticatedClientElement
      action="update"
      ressourceType="courses"
      checkMethod="roles"
      orgId={course.org_id}
    >
      <div className="absolute top-2 right-2 z-20 opacity-0 transition-all duration-200 group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger
            nativeButton
            render={
              <Button
                variant="secondary"
                size="icon"
                className="bg-background/90 hover:bg-background h-8 w-8 rounded-full border-0 shadow-lg backdrop-blur-md transition-all hover:scale-110"
                aria-label={t('courseOptions', { defaultValue: 'Course options' })}
              />
            }
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-background/95 w-56 border-0 shadow-xl backdrop-blur-md"
            sideOffset={8}
          >
            <DropdownMenuItem
              nativeButton={false}
              render={
                <Link
                  prefetch={false}
                  href={getUriWithOrg(orgSlug, `/dash/courses/course/${courseIdClean}/content`)}
                />
              }
              className="focus:bg-muted/50 flex items-center hover:cursor-pointer"
            >
              <FilePenLine className="mr-2 h-4 w-4" /> {t('editContent')}
            </DropdownMenuItem>
            <DropdownMenuItem
              nativeButton={false}
              render={
                <Link
                  prefetch={false}
                  href={getUriWithOrg(orgSlug, `/dash/courses/course/${courseIdClean}/general`)}
                />
              }
              className="focus:bg-muted/50 flex items-center hover:cursor-pointer"
            >
              <Settings2 className="mr-2 h-4 w-4" /> {t('settings')}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              className="focus:bg-destructive/10 cursor-pointer"
            >
              <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
              >
                <AlertDialogTrigger
                  render={
                    <button
                      className="flex py-1.5"
                      type="button"
                    >
                      <BookMinus className="mr-4 h-4 w-4" /> {t('delete')}
                    </button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogMedia className="bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400">
                      <AlertTriangle className="size-8" />
                    </AlertDialogMedia>
                    <AlertDialogTitle>{t('deleteConfirmationTitle', { courseName: course.name })}</AlertDialogTitle>
                    <AlertDialogDescription>{t('deleteConfirmationMessage')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel />
                    <AlertDialogAction
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={isPending}
                    >
                      {isPending ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="size-4 animate-spin" />
                          {t('deleting')}
                        </div>
                      ) : (
                        t('deleteButtonText')
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </AuthenticatedClientElement>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const CourseThumbnail: FC<CourseThumbnailProps> = ({
  course,
  orgslug,
  customLink,
  trailData,
  trailLoading = false,
}) => {
  const t = useTranslations('Components.CourseThumbnail');
  const locale = useLocale();
  const router = useRouter();
  const org = useOrg() as any;
  const session = usePlatformSession() as any;

  // Memoized computed values
  const activeAuthors = useMemo(
    () => course.authors?.filter((a) => a.authorship_status === 'ACTIVE') || [],
    [course.authors],
  );

  const cleanCourseUuid = useMemo(() => removeCoursePrefix(course.course_uuid), [course.course_uuid]);

  const courseRun = useMemo(() => {
    return trailData?.runs?.find((run: any) => {
      const cleanRunCourseUuid = run.course?.course_uuid?.replace('course_', '');
      return cleanRunCourseUuid === cleanCourseUuid;
    });
  }, [trailData, cleanCourseUuid]);

  const { totalActivities, completedActivities, progressPercentage } = useMemo(() => {
    const total =
      courseRun?.course_total_steps ||
      course.chapters?.reduce((acc, chapter) => acc + chapter.activities.length, 0) ||
      0;
    const completed = courseRun?.steps?.filter((step: any) => step.complete === true)?.length || 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      totalActivities: total,
      completedActivities: completed,
      progressPercentage: percentage,
    };
  }, [courseRun, course.chapters]);

  const thumbnailUrl = useMemo(() => {
    return course.thumbnail_image
      ? getCourseThumbnailMediaDirectory(org?.org_uuid, course.course_uuid, course.thumbnail_image)
      : '../empty_thumbnail.webp';
  }, [course.thumbnail_image, course.course_uuid, org?.org_uuid]);

  const courseUrl = useMemo(
    () => customLink || getUriWithOrg(orgslug, `/course/${cleanCourseUuid}`),
    [customLink, orgslug, cleanCourseUuid],
  );

  const isEnrolled = Boolean(courseRun);
  const titleId = `course-title-${cleanCourseUuid}`;

  // Delete handler
  const handleDelete = async () => {
    const toastId = toast.loading(t('deleting'));
    try {
      await deleteCourseFromBackend(course.course_uuid, session.data?.tokens?.access_token);
      await revalidateTags(['courses'], orgslug);
      toast.success(t('toastDeleteSuccess'));
      router.refresh();
    } catch {
      toast.error(t('toastDeleteError'));
    } finally {
      toast.dismiss(toastId);
    }
  };

  return (
    <Card
      role="article"
      aria-labelledby={titleId}
      className="group bg-card focus-visible:ring-primary/60 relative flex h-full w-full max-w-sm min-w-[260px] flex-col overflow-hidden border-0 p-0 shadow-md transition-all duration-200 hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      tabIndex={0}
    >
      <AdminMenu
        course={course}
        orgSlug={orgslug}
        onDelete={handleDelete}
      />

      <CourseImage
        thumbnailUrl={thumbnailUrl}
        courseName={course.name}
        updateDate={course.update_date}
        locale={locale}
        courseUrl={courseUrl}
        t={t}
      />

      <CardContent className="flex flex-1 flex-col gap-1 px-4 pb-2">
        <div className="flex-1 space-y-1">
          <Link
            prefetch={false}
            href={courseUrl}
            className="group-hover:text-primary block transition-colors"
            aria-label={t('openCourse', { course: course.name })}
          >
            <h3
              id={titleId}
              className="line-clamp-2 leading-tight font-semibold tracking-tight text-gray-900"
            >
              {course.name}
            </h3>
          </Link>
          <p className="text-muted-foreground line-clamp-2 text-sm">{course.description}</p>
        </div>

        <AuthorsDisplay
          authors={activeAuthors}
          t={t}
        />
      </CardContent>

      <CardFooter className="bg-muted/30 mt-auto border-t p-3">
        <CourseActions
          isEnrolled={isEnrolled}
          isLoading={trailLoading}
          progressPercentage={progressPercentage}
          courseUrl={courseUrl}
          courseName={course.name}
          t={t}
        />
      </CardFooter>
    </Card>
  );
};

export default CourseThumbnail;
export { removeCoursePrefix };
