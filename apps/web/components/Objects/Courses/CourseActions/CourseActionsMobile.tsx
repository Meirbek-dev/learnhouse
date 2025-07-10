'use client';

import { useLHSession } from '@components/Contexts/LHSessionContext';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import { getUriWithOrg, getUriWithoutOrg } from '@services/config/config';
import { removeCourse, startCourse } from '@services/courses/activity';
import { getUserAvatarMediaDirectory } from '@services/media/media';
import { checkPaidAccess } from '@services/payments/payments';
import { getProductsByCourse } from '@services/payments/products';
import { revalidateTags } from '@services/utils/ts/requests';
import { AlertCircle, LogIn, LogOut, ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import UserAvatar from '../../UserAvatar';

import CoursePaidOptions from './CoursePaidOptions';

interface Author {
  user: {
    user_uuid: string;
    avatar_image: string;
    first_name: string;
    last_name: string;
    username: string;
  };
  authorship: 'CREATOR' | 'CONTRIBUTOR' | 'MAINTAINER' | 'REPORTER';
  authorship_status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
}

interface CourseRun {
  status: string;
  course_id: number;
}

interface Course {
  id: string;
  course_uuid: string;
  authors: Author[];
  trail?: {
    runs: CourseRun[];
  };
  chapters?: {
    name: string;
    activities: {
      activity_uuid: string;
      name: string;
      activity_type: string;
    }[];
  }[];
}

interface CourseActionsMobileProps {
  courseuuid: string;
  orgslug: string;
  course: Course & {
    org_id: number;
  };
  trailData?: any;
}

// Component for displaying multiple authors
const MultipleAuthors = ({ authors }: { authors: Author[] }) => {
  const t = useTranslations('Courses.CourseActionsMobile');

  // Early return if no authors
  if (!authors || authors.length === 0) {
    return (
      <div className="flex items-center gap-3">
        <div className="text-sm text-neutral-400">{t('noAuthors')}</div>
      </div>
    );
  }

  const displayedAvatars = authors.slice(0, 3);
  const remainingCount = Math.max(0, authors.length - 3);

  // Avatar size for mobile
  const avatarSize = 36;
  const borderSize = 'border-2';

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex -space-x-3">
        {displayedAvatars.map((author, index) => (
          <div
            key={author.user.user_uuid}
            className="relative"
            style={{ zIndex: displayedAvatars.length - index }}
          >
            <UserAvatar
              border={borderSize}
              rounded="rounded-full"
              avatar_url={
                author.user.avatar_image
                  ? getUserAvatarMediaDirectory(author.user.user_uuid, author.user.avatar_image)
                  : ''
              }
              predefined_avatar={author.user.avatar_image ? undefined : 'empty'}
              width={avatarSize}
            />
          </div>
        ))}
        {remainingCount > 0 && (
          <div
            className="relative"
            style={{ zIndex: 0 }}
          >
            <div
              className="flex items-center justify-center rounded-full border-2 border-white bg-neutral-100 font-medium text-neutral-600 shadow-sm"
              style={{
                width: `${avatarSize}px`,
                height: `${avatarSize}px`,
                fontSize: '12px',
              }}
            >
              +{remainingCount}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col">
        <span className="text-xs font-medium text-neutral-400">{authors.length > 1 ? t('authors') : t('author')}</span>
        {authors.length === 1 ? (
          <span className="text-sm font-semibold text-neutral-800">
            {authors[0]?.user?.first_name && authors[0]?.user?.last_name
              ? `${authors[0].user.first_name} ${authors[0].user.last_name}`
              : `@${authors[0]?.user?.username || 'Unknown'}`}
          </span>
        ) : (
          <span className="text-sm font-semibold text-neutral-800">
            {authors[0]?.user?.first_name && authors[0]?.user?.last_name
              ? `${authors[0].user.first_name} ${authors[0].user.last_name}`
              : `@${authors[0]?.user?.username || 'Unknown'}`}
            {authors.length > 1 && ` ${t('moreAuthors', { count: authors.length - 1 })}`}
          </span>
        )}
      </div>
    </div>
  );
};

const CourseActionsMobile = ({ courseuuid, orgslug, course, trailData }: CourseActionsMobileProps) => {
  const t = useTranslations('Courses.CourseActionsMobile');
  const router = useRouter();
  const session = useLHSession() as any;
  const [linkedProducts, setLinkedProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  // Clean up course UUID by removing 'course_' prefix if it exists
  const cleanCourseUuid = course.course_uuid?.replace('course_', '');

  const isStarted =
    trailData?.runs?.find((run: any) => {
      const cleanRunCourseUuid = run.course?.course_uuid?.replace('course_', '');
      return cleanRunCourseUuid === cleanCourseUuid;
    }) ?? false;

  useEffect(() => {
    const fetchLinkedProducts = async () => {
      try {
        const response = await getProductsByCourse(course.org_id, course.id, session.data?.tokens?.access_token);
        setLinkedProducts(response.data || []);
      } catch {
        console.error('Failed to fetch linked products');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLinkedProducts();
  }, [course.id, course.org_id, session.data?.tokens?.access_token]);

  useEffect(() => {
    const checkAccess = async () => {
      if (!session.data?.user) return;
      try {
        const response = await checkPaidAccess(
          Number.parseInt(course.id, 10), // TODO: why parsing course id as int?
          course.org_id,
          session.data?.tokens?.access_token,
        );
        setHasAccess(response.has_access);
      } catch {
        console.error('Failed to check course access');
        setHasAccess(false);
      }
    };

    if (linkedProducts.length > 0) {
      checkAccess();
    }
  }, [course.id, course.org_id, session.data?.tokens?.access_token, session.data?.user, linkedProducts]);

  const handleCourseAction = async () => {
    if (!session.data?.user) {
      router.push(getUriWithoutOrg(`/signup?orgslug=${orgslug}`));
      return;
    }

    setIsActionLoading(true);
    try {
      if (isStarted) {
        await removeCourse(`course_${courseuuid}`, orgslug, session.data?.tokens?.access_token);
        await revalidateTags(['courses'], orgslug);
        router.refresh();
      } else {
        await startCourse(`course_${courseuuid}`, orgslug, session.data?.tokens?.access_token);
        await revalidateTags(['courses'], orgslug);

        // Get the first activity from the first chapter
        const firstChapter = course.chapters?.[0];
        const firstActivity = firstChapter?.activities?.[0];

        if (firstActivity) {
          // Redirect to the first activity
          await revalidateTags(['activities'], orgslug);
          router.push(
            `${getUriWithOrg(orgslug, '')}/course/${courseuuid}/activity/${firstActivity.activity_uuid.replace('activity_', '')}`,
          );
        } else {
          router.refresh();
        }
      }
    } catch (error) {
      console.error('Failed to perform course action:', error);
    } finally {
      setIsActionLoading(false);
      await revalidateTags(['courses'], orgslug);
    }
  };

  if (isLoading) {
    return <div className="mb-8 mt-4 h-16 animate-pulse rounded-lg bg-gray-100" />;
  }

  // Filter active authors and sort by role priority
  const sortedAuthors = [...course.authors]
    .filter((author) => author.authorship_status === 'ACTIVE')
    .sort((a, b) => {
      const rolePriority: { [key: string]: number } = {
        CREATOR: 0,
        MAINTAINER: 1,
        CONTRIBUTOR: 2,
        REPORTER: 3,
      };
      const aPriority = rolePriority[a.authorship] ?? 999;
      const bPriority = rolePriority[b.authorship] ?? 999;
      return aPriority - bPriority;
    });

  return (
    <div className="mx-2 my-6 overflow-hidden rounded-lg bg-white/90 p-4 shadow-md shadow-gray-300/25 outline-1 outline-neutral-200/40 backdrop-blur-sm">
      <div className="flex flex-col space-y-4">
        <MultipleAuthors authors={sortedAuthors} />

        {linkedProducts.length > 0 ? (
          <div className="space-y-3">
            {hasAccess ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  <span className="text-sm font-semibold text-green-800">{t('ownCourse')}</span>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-800" />
                  <span className="text-sm font-semibold text-amber-800">{t('paidCourse')}</span>
                </div>
              </div>
            )}

            {hasAccess ? (
              <button
                onClick={handleCourseAction}
                disabled={isActionLoading}
                className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  isStarted
                    ? 'bg-red-500 text-white hover:bg-red-600 disabled:bg-red-400'
                    : 'bg-primary hover:bg-primary text-white disabled:bg-neutral-700'
                }`}
              >
                {isActionLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : isStarted ? (
                  <>
                    <LogOut className="h-4 w-4" />
                    {t('leaveCourse')}
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    {t('startCourse')}
                  </>
                )}
              </button>
            ) : (
              <>
                <Modal
                  isDialogOpen={isModalOpen}
                  onOpenChange={setIsModalOpen}
                  dialogContent={<CoursePaidOptions course={course} />}
                  dialogTitle={t('modalTitle')}
                  dialogDescription={t('modalDescription')}
                  minWidth="sm"
                />
                <button
                  onClick={() => setIsModalOpen(true)}
                  disabled={isActionLoading}
                  className="bg-primary hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:bg-neutral-700"
                >
                  {isActionLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4" />
                      {t('purchaseCourse')}
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={handleCourseAction}
            disabled={isActionLoading}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              isStarted
                ? 'bg-red-500 text-white hover:bg-red-600 disabled:bg-red-400'
                : 'bg-primary hover:bg-primary/90 text-white disabled:bg-neutral-700'
            }`}
          >
            {isActionLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : !session.data?.user ? (
              <>
                <LogIn className="h-4 w-4" />
                {t('signIn')}
              </>
            ) : isStarted ? (
              <>
                <LogOut className="h-4 w-4" />
                {t('leaveCourse')}
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                {t('startCourse')}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default CourseActionsMobile;
