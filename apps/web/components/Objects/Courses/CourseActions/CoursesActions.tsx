import { AlertCircle, ArrowRight, BookOpen, ClockIcon, ShoppingCart, UserPen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { mutate } from 'swr';

import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import UserAvatar from '@components/Objects/UserAvatar';
import { getAPIUrl, getUriWithOrg, getUriWithoutOrg } from '@services/config/config';
import { removeCourse, startCourse } from '@services/courses/activity';
import { applyForContributor } from '@services/courses/courses';
import { checkPaidAccess } from '@services/payments/payments';
import { getProductsByCourse } from '@services/payments/products';
import { revalidateTags } from '@services/utils/ts/requests';

import { useContributorStatus } from '../../../../hooks/useContributorStatus';
import CourseProgress from '../CourseProgress/CourseProgress';

import CoursePaidOptions from './CoursePaidOptions';

interface CourseRun {
  status: string;
  course_id: string;
  steps: {
    activity_id: string;
    complete: boolean;
  }[];
}

interface Course {
  id: string;
  course_uuid: string;
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
  open_to_contributors?: boolean;
}

interface CourseActionsProps {
  courseuuid: string;
  orgslug: string;
  course: Course & {
    org_id: number;
  };
  trailData?: any;
}

function CoursesActions({ courseuuid, orgslug, course, trailData }: CourseActionsProps) {
  const router = useRouter();
  const session = useLHSession() as any;
  const [linkedProducts, setLinkedProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isContributeLoading, setIsContributeLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const { contributorStatus, refetch } = useContributorStatus(courseuuid);
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const org = useOrg() as any;
  const t = useTranslations('Courses.CoursesActions');

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
          Number.parseInt(course.id, 10),
          course.org_id,
          session.data?.tokens?.access_token,
        );
        setHasAccess(response.has_access);
      } catch {
        console.error('Failed to check course access');
        toast.error('Failed to check course access. Please try again later.');
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
    const loadingToast = toast.loading(isStarted ? t('leavingCourse') : t('startingCourse'));

    try {
      if (isStarted) {
        await removeCourse(`course_${courseuuid}`, orgslug, session.data?.tokens?.access_token);
        mutate(`${getAPIUrl()}trail/org/${org?.id}/trail`);
        toast.success(t('leftCourseSuccess'), { id: loadingToast });
        router.refresh();
      } else {
        await startCourse(`course_${courseuuid}`, orgslug, session.data?.tokens?.access_token);
        mutate(`${getAPIUrl()}trail/org/${org?.id}/trail`);
        toast.success(t('startedCourseSuccess'), { id: loadingToast });

        // Get the first activity from the first chapter
        const firstChapter = course.chapters?.[0];
        const firstActivity = firstChapter?.activities?.[0];

        if (firstActivity) {
          // Redirect to the first activity
          router.push(
            `${getUriWithOrg(orgslug, '')}/course/${courseuuid}/activity/${firstActivity.activity_uuid.replace('activity_', '')}`,
          );
        } else {
          mutate(`${getAPIUrl()}trail/org/${org?.id}/trail`);
          router.refresh();
        }
      }
    } catch (error) {
      console.error('Failed to perform course action:', error);
      toast.error(isStarted ? t('leaveCourseError') : t('startCourseError'), {
        id: loadingToast,
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleApplyToContribute = async () => {
    if (!session.data?.user) {
      router.push(getUriWithoutOrg(`/signup?orgslug=${orgslug}`));
      return;
    }

    setIsContributeLoading(true);
    const loadingToast = toast.loading(t('submittingContributorApplication'));

    try {
      const data = {
        message: t('contributorApplicationMessage'),
      };

      await applyForContributor(`course_${courseuuid}`, data, session.data?.tokens?.access_token);
      await revalidateTags(['courses'], orgslug);
      await refetch();
      toast.success(t('contributorApplicationSuccess'), { id: loadingToast });
    } catch (error) {
      console.error('Failed to apply as contributor:', error);
      toast.error(t('contributorApplicationError'), { id: loadingToast });
    } finally {
      setIsContributeLoading(false);
    }
  };

  const renderActionButton = (action: 'start' | 'leave') => {
    if (!session.data?.user) {
      return (
        <>
          <UserAvatar
            width={24}
            predefined_avatar="empty"
            rounded="rounded-full"
            border="border-2"
            borderColor="border-white"
          />
          <span>{action === 'start' ? t('startCourse') : t('leaveCourse')}</span>
          <ArrowRight className="h-5 w-5" />
        </>
      );
    }

    return (
      <>
        <UserAvatar
          width={24}
          use_with_session
          rounded="rounded-full"
          border="border-2"
          borderColor="border-white"
        />
        <span>{action === 'start' ? t('startCourse') : t('leaveCourse')}</span>
        <ArrowRight className="h-5 w-5" />
      </>
    );
  };

  const renderContributorButton = () => {
    if (contributorStatus === 'INACTIVE' || course.open_to_contributors !== true) {
      return null;
    }

    if (!session.data?.user) {
      return (
        <button
          onClick={() => router.push(getUriWithoutOrg(`/signup?orgslug=${orgslug}`))}
          className="soft-shadow mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white py-3 font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          <UserPen className="h-5 w-5" />
          {t('authenticateToContribute')}
        </button>
      );
    }

    if (contributorStatus === 'ACTIVE') {
      return (
        <div className="soft-shadow mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 py-3 font-semibold text-green-700">
          <UserPen className="h-5 w-5" />
          {t('youAreAContributor')}
        </div>
      );
    }

    if (contributorStatus === 'PENDING') {
      return (
        <div className="soft-shadow mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 py-3 font-semibold text-amber-700">
          <ClockIcon className="h-5 w-5" />
          {t('contributorApplicationPending')}
        </div>
      );
    }

    return (
      <button
        onClick={handleApplyToContribute}
        disabled={isContributeLoading}
        className="soft-shadow mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-white py-3 font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed"
      >
        {isContributeLoading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-700 border-t-transparent" />
        ) : (
          <>
            <UserPen className="h-5 w-5" />
            {t('applyToContribute')}
          </>
        )}
      </button>
    );
  };

  const renderProgressSection = () => {
    const totalActivities =
      course.chapters?.reduce((acc: number, chapter: any) => acc + chapter.activities.length, 0) || 0;

    // Find the correct run using the cleaned UUID
    const run = trailData?.runs?.find((run: any) => {
      const cleanRunCourseUuid = run.course?.course_uuid?.replace('course_', '');
      return cleanRunCourseUuid === cleanCourseUuid;
    });

    const completedActivities = run?.steps?.filter((step: any) => step.complete)?.length || 0;

    const progressPercentage = totalActivities === 0 ? 0 : Math.round((completedActivities / totalActivities) * 100);

    if (!isStarted) {
      return (
        <div className="soft-shadow relative overflow-hidden rounded-lg bg-white">
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage: 'radial-gradient(circle at center, #101010 1px, transparent 1px)',
              backgroundSize: '12px 12px',
            }}
          />
          <div className="relative p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16">
                    <svg className="h-full w-full -rotate-90 transform">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="#e5e7eb"
                        strokeWidth="6"
                        fill="none"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <BookOpen className="h-6 w-6 text-neutral-400" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{t('readyToBegin')}</div>
                    {totalActivities > 0 && (
                      <div className="text-sm text-gray-500">{t('startLearningJourney', { totalActivities })}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="soft-shadow relative overflow-hidden rounded-lg bg-white">
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: 'radial-gradient(circle at center, #000 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16">
                  <svg className="h-full w-full -rotate-90 transform">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="#e5e7eb"
                      strokeWidth="6"
                      fill="none"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="#10b981"
                      strokeWidth="6"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 28}
                      strokeDashoffset={
                        totalActivities === 0 ? 0 : 2 * Math.PI * 28 * (1 - completedActivities / totalActivities)
                      }
                      className="transition-all duration-500 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-gray-800">{progressPercentage}%</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsProgressOpen(true)}
                  className="flex-1 rounded-lg p-2 text-left transition-colors hover:bg-neutral-50/50"
                >
                  <div className="text-sm font-medium text-gray-900">{t('courseProgress')}</div>
                  <div className="text-sm text-gray-500">
                    {t('completedActivities', {
                      completedActivities,
                      totalActivities,
                    })}
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return <div className="soft-shadow h-20 animate-pulse rounded-lg bg-gray-100" />;
  }

  if (linkedProducts.length > 0) {
    return (
      <div className="overflow-hidden rounded-lg bg-white p-4 shadow-md shadow-gray-300/25 outline-1 outline-neutral-200/40">
        <div className="space-y-4">
          {hasAccess ? (
            <>
              <div className="soft-shadow rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  <h3 className="font-semibold text-green-800">{t('youOwnThisCourse')}</h3>
                </div>
                <p className="mt-1 text-sm text-green-700">{t('youHavePurchasedThisCourse')}</p>
              </div>
              <button
                onClick={handleCourseAction}
                disabled={isActionLoading}
                className={`soft-shadow flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg py-3 font-semibold transition-colors ${
                  isStarted
                    ? 'bg-red-500 text-white hover:bg-red-600 disabled:bg-red-400'
                    : 'bg-primary hover:bg-primary/90 text-white disabled:bg-neutral-700'
                }`}
              >
                {isActionLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  renderActionButton(isStarted ? 'leave' : 'start')
                )}
              </button>
              {renderContributorButton()}
            </>
          ) : (
            <>
              <div className="soft-shadow rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-800" />
                  <h3 className="font-semibold text-amber-800">{t('paidCourse')}</h3>
                </div>
                <p className="mt-1 text-sm text-amber-700">{t('courseRequiresPurchase')}</p>
              </div>
              <Modal
                isDialogOpen={isModalOpen}
                onOpenChange={setIsModalOpen}
                dialogContent={<CoursePaidOptions course={course} />}
                dialogTitle={t('purchaseCourse')}
                dialogDescription={t('selectPaymentOption')}
                minWidth="sm"
              />
              <button
                className="soft-shadow bg-primary hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-lg py-3 font-semibold text-white transition-colors"
                onClick={() => setIsModalOpen(true)}
              >
                <ShoppingCart className="h-5 w-5" />
                {t('purchaseCourse')}
              </button>
              {renderContributorButton()}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white p-4 shadow-md shadow-gray-300/25 outline-1 outline-neutral-200/40">
      <div className="space-y-4">
        {/* Progress Section */}
        {renderProgressSection()}

        {/* Start/Leave Course Button */}
        <button
          onClick={handleCourseAction}
          disabled={isActionLoading}
          className={`soft-shadow flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg py-3 font-semibold transition-colors ${
            isStarted
              ? 'bg-red-500 text-white hover:bg-red-600 disabled:bg-red-400'
              : 'bg-primary hover:bg-primary/70 text-white disabled:bg-neutral-700'
          }`}
        >
          {isActionLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            renderActionButton(isStarted ? 'leave' : 'start')
          )}
        </button>

        {/* Contributor Button */}
        {renderContributorButton()}

        {/* Course Progress Modal */}
        <CourseProgress
          course={course}
          orgslug={orgslug}
          isOpen={isProgressOpen}
          onClose={() => setIsProgressOpen(false)}
          trailData={trailData}
        />
      </div>
    </div>
  );
}

export default CoursesActions;
