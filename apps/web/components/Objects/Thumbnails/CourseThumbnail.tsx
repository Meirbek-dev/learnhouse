'use client';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@components/ui/dropdown-menu';
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal';
import { getCourseThumbnailMediaDirectory, getUserAvatarMediaDirectory } from '@services/media/media';
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement';
import { BookMinus, Calendar, FilePenLine, MoreVertical, Settings2 } from 'lucide-react';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { deleteCourseFromBackend } from '@services/courses/courses';
import { Card, CardContent, CardFooter } from '@components/ui/card';
import { revalidateTags } from '@services/utils/ts/requests';
import { useOrg } from '@components/Contexts/OrgContext';
import UserAvatar from '@components/Objects/UserAvatar';
import { getUriWithOrg } from '@services/config/config';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import type { FC } from 'react';
import Link from 'next/link';

// Utility types and functions
export interface Course {
  course_uuid: string;
  name: string;
  description: string;
  thumbnail_image: string;
  org_id: number;
  update_date: string;
  authors?: {
    user: {
      id: number;
      user_uuid: string;
      avatar_image: string;
      first_name: string;
      last_name: string;
      username: string;
    };
    authorship: 'CREATOR' | 'CONTRIBUTOR' | 'MAINTAINER' | 'REPORTER';
    authorship_status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  }[];
}

export interface PropsType {
  course: Course;
  orgslug: string;
  customLink?: string;
}

export const removeCoursePrefix = (course_uuid: string) => course_uuid.replace('course_', '');

const CourseThumbnail: FC<PropsType> = ({ course, orgslug, customLink }: PropsType) => {
  const t = useTranslations('Components.CourseThumbnail');
  const locale = useLocale();
  const router = useRouter();
  const org = useOrg() as any;
  const session = useLHSession() as any;

  const activeAuthors = course.authors?.filter((a) => a.authorship_status === 'ACTIVE') || [];
  const displayedAuthors = activeAuthors.slice(0, 3);
  const hasMoreAuthors = activeAuthors.length > 3;
  const remainingAuthorsCount = activeAuthors.length - 3;

  const deleteCourse = async () => {
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

  const thumbnailImage = course.thumbnail_image
    ? getCourseThumbnailMediaDirectory(org?.org_uuid, course.course_uuid, course.thumbnail_image)
    : '../empty_thumbnail.webp';

  const courseUrl = customLink || getUriWithOrg(orgslug, `/course/${removeCoursePrefix(course.course_uuid)}`);

  return (
    <Card className="group bg-card relative w-full max-w-sm min-w-[280px] overflow-hidden border-0 p-0 shadow-sm transition-all duration-300 hover:shadow-xl">
      <AdminEditOptions
        course={course}
        orgSlug={orgslug}
        deleteCourse={deleteCourse}
      />

      {/* Course Image */}
      <Link
        prefetch
        href={courseUrl}
        className="relative block overflow-hidden"
      >
        <div className="bg-muted relative aspect-video w-full overflow-hidden">
          <img
            className="h-full w-full object-cover transition-all duration-300 group-hover:scale-110"
            src={thumbnailImage}
            alt={course.name}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {/* Course metadata overlay */}
          <div className="absolute right-2 bottom-2 left-2 flex items-end justify-between">
            {course.update_date ? (
              <Badge
                variant="secondary"
                className="bg-background/90 text-xs backdrop-blur-sm"
              >
                <Calendar className="mr-1 h-3 w-3" />
                {t('updated')}{' '}
                {new Date(course.update_date).toLocaleDateString(locale, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Badge>
            ) : null}
          </div>
        </div>
      </Link>

      <CardContent className="space-y-2 px-4 pb-2">
        {/* Course Title and Description */}
        <div className="space-y-2">
          <Link
            href={courseUrl}
            className="group-hover:text-primary block transition-colors"
          >
            <h3 className="line-clamp-2 truncate text-lg leading-tight font-semibold tracking-tight">{course.name}</h3>
          </Link>
          <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">{course.description}</p>
        </div>

        {/* Authors Section */}
        {displayedAuthors.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center -space-x-2">
              <span className="text-muted-foreground pr-4 text-xs">
                {t('authorLabel', { count: activeAuthors.length })}
              </span>
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
              {hasMoreAuthors ? (
                <div className="relative z-0">
                  <div className="border-background bg-muted text-muted-foreground hover:bg-muted/80 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium transition-colors">
                    +{remainingAuthorsCount}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button
          asChild
          size="sm"
          className="group-hover:bg-primary/90 w-full transition-all duration-200"
        >
          <Link href={courseUrl}>{t('startLearning')}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

const AdminEditOptions: FC<{
  course: Course;
  orgSlug: string;
  deleteCourse: () => Promise<void>;
}> = ({ course, orgSlug, deleteCourse }) => {
  const t = useTranslations('Components.CourseThumbnail');
  return (
    <AuthenticatedClientElement
      action="update"
      ressourceType="courses"
      checkMethod="roles"
      orgId={course.org_id}
    >
      <div className="absolute top-2 right-2 z-20 opacity-0 transition-all duration-200 group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="bg-background/90 hover:bg-background h-8 w-8 rounded-full border-0 shadow-lg backdrop-blur-md transition-all hover:scale-110"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-background/95 w-56 border-0 shadow-xl backdrop-blur-md"
            sideOffset={8}
          >
            <DropdownMenuItem
              asChild
              className="focus:bg-muted/50 cursor-pointer"
            >
              <Link
                prefetch
                href={getUriWithOrg(orgSlug, `/dash/courses/course/${removeCoursePrefix(course.course_uuid)}/content`)}
                className="flex items-center"
              >
                <FilePenLine className="mr-2 h-4 w-4" /> {t('editContent')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              asChild
              className="focus:bg-muted/50 cursor-pointer"
            >
              <Link
                prefetch
                href={getUriWithOrg(orgSlug, `/dash/courses/course/${removeCoursePrefix(course.course_uuid)}/general`)}
                className="flex items-center"
              >
                <Settings2 className="mr-2 h-4 w-4" /> {t('settings')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              asChild
              className="focus:bg-destructive/10 cursor-pointer"
            >
              <ConfirmationModal
                confirmationButtonText={t('deleteButtonText')}
                confirmationMessage={t('deleteConfirmationMessage')}
                dialogTitle={t('deleteConfirmationTitle', {
                  courseName: course.name,
                })}
                dialogTrigger={
                  <button className="text-destructive hover:bg-destructive/10 focus:bg-destructive/10 flex w-full items-center rounded-sm py-1.5 text-left text-sm transition-all">
                    <BookMinus className="mr-4 ml-2 h-4 w-4" /> {t('delete')}
                  </button>
                }
                functionToExecute={deleteCourse}
                status="warning"
              />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </AuthenticatedClientElement>
  );
};

export default CourseThumbnail;
