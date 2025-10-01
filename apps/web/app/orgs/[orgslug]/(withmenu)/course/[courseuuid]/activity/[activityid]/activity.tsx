'use client';
import {
  BookOpenCheck,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Loader2,
  Maximize2,
  Minimize2,
  UserRoundPen,
} from 'lucide-react';
import AssignmentSubmissionProvider, {
  useAssignmentSubmission,
} from '@components/Contexts/Assignments/AssignmentSubmissionContext';
import {
  getAssignmentFromActivityUUID,
  getFinalGrade,
  submitAssignmentForGrading,
} from '@services/courses/assignments';
import PaidCourseActivityDisclaimer from '@components/Objects/Courses/CourseActions/PaidCourseActivityDisclaimer';
import type { AssignmentSubmission } from '@components/Contexts/Assignments/AssignmentSubmissionContext';
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal';
import { getCourseThumbnailMediaDirectory, getUserAvatarMediaDirectory } from '@services/media/media';
import { AssignmentsTaskProvider } from '@components/Contexts/Assignments/AssignmentsTaskContext';
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper';
import { markActivityAsComplete, unmarkActivityAsComplete } from '@services/courses/activity';
import FixedActivitySecondaryBar from '@components/Pages/Activity/FixedActivitySecondaryBar';
import { useOptionalGamificationContext } from '@/components/Contexts/GamificationContext';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ActivityChapterDropdown from '@components/Pages/Activity/ActivityChapterDropdown';
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement';
import { AssignmentProvider } from '@components/Contexts/Assignments/AssignmentContext';
import ActivityBreadcrumbs from '@components/Pages/Activity/ActivityBreadcrumbs';
import ActivityIndicators from '@components/Pages/Courses/ActivityIndicators';
import ToolTip from '@components/Objects/StyledElements/Tooltip/Tooltip';
import CourseEndView from '@components/Pages/Activity/CourseEndView';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { CourseProvider } from '@components/Contexts/CourseContext';
import { useContributorStatus } from '@/hooks/useContributorStatus';
import { getAPIUrl, getUriWithOrg } from '@services/config/config';
import MiniInfoTooltip from '@components/Objects/MiniInfoTooltip';
import { useOrg } from '@components/Contexts/OrgContext';
import { swrFetcher } from '@services/utils/ts/requests';
import { usePathname, useRouter } from 'next/navigation';
import UserAvatar from '@components/Objects/UserAvatar';
import { AnimatePresence, motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'react-hot-toast';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';

// Lazy load heavy components
const Canva = lazy(() => import('@components/Objects/Activities/DynamicCanva/DynamicCanva'));
const VideoActivity = lazy(() => import('@components/Objects/Activities/Video/Video'));
const DocumentPdfActivity = lazy(() => import('@components/Objects/Activities/DocumentPdf/DocumentPdf'));
const AssignmentStudentActivity = lazy(
  () => import('@components/Objects/Activities/Assignment/AssignmentStudentActivity'),
);
const AIActivityAsk = lazy(() => import('@components/Objects/Activities/AI/AIActivityAsk'));
const AIChatBotProvider = lazy(() => import('@components/Contexts/AI/AIChatBotContext'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex h-64 items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin" />
  </div>
);

interface ActivityClientProps {
  activityid: string;
  courseuuid: string;
  orgslug: string;
  activity: any | null;
  course: any;
}

interface ActivityActionsProps {
  activity: any | null;
  activityid: string;
  course: any;
  orgslug: string;
  assignment: any;
  showNavigation?: boolean;
}

// Custom hook for activity position
function useActivityPosition(course: any, activityId: string) {
  return useMemo(() => {
    const allActivities: any[] = [];
    let currentIndex = -1;

    course.chapters.forEach((chapter: any) => {
      chapter.activities.forEach((activity: any) => {
        const cleanActivityUuid = activity.activity_uuid?.replace('activity_', '');
        allActivities.push({
          ...activity,
          cleanUuid: cleanActivityUuid,
          chapterName: chapter.name,
        });

        if (cleanActivityUuid === activityId.replace('activity_', '')) {
          currentIndex = allActivities.length - 1;
        }
      });
    });

    return { allActivities, currentIndex };
  }, [course, activityId]);
}

const ActivityActions = ({
  activity,
  activityid,
  course,
  orgslug,
  assignment,
  showNavigation = true,
}: ActivityActionsProps) => {
  const t = useTranslations('ActivityPage');
  const { contributorStatus } = useContributorStatus(course.course_uuid);
  const org = useOrg() as any;
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;

  // Add SWR for trail data
  const { data: trailData } = useSWR(`${getAPIUrl()}trail/org/${org?.id}/trail`, (url) =>
    swrFetcher(url, access_token),
  );

  return (
    <div className="flex items-center space-x-2">
      {activity && activity.published === true && activity.content.paid_access !== false ? (
        <AuthenticatedClientElement checkMethod="authentication">
          {activity.activity_type !== 'TYPE_ASSIGNMENT' && (
            <MarkStatus
              activity={activity}
              activityid={activityid}
              course={course}
              orgslug={orgslug}
              trailData={trailData}
              t={t}
            />
          )}
          {activity.activity_type === 'TYPE_ASSIGNMENT' && assignment?.assignment_uuid ? (
            <AssignmentSubmissionProvider assignment_uuid={assignment.assignment_uuid}>
              <AssignmentTools
                assignment={assignment}
                activity={activity}
                activityid={activityid}
                course={course}
                orgslug={orgslug}
                t={t}
              />
            </AssignmentSubmissionProvider>
          ) : null}
          {showNavigation ? (
            <NextActivityButton
              course={course}
              currentActivityId={activity.id}
              orgslug={orgslug}
            />
          ) : null}
        </AuthenticatedClientElement>
      ) : null}
    </div>
  );
};

// Helper to ensure Tiptap always receives a valid document
function getValidTiptapContent(content: any): any {
  if (content && typeof content === 'object' && content.type === 'doc' && Array.isArray(content.content)) {
    return content;
  }
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

const ActivityClient = (props: ActivityClientProps) => {
  const { activityid } = props;
  const { courseuuid } = props;
  const { orgslug } = props;
  const { activity } = props;
  const { course } = props;
  const org = useOrg() as any;
  const session = useLHSession() as any;
  const pathname = usePathname();
  const access_token = session?.data?.tokens?.access_token;
  const [bgColor, setBgColor] = useState('bg-white');
  const [assignment, setAssignment] = useState(null) as any;
  const [markStatusButtonActive, setMarkStatusButtonActive] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const isInitialRender = useRef(true);
  const { contributorStatus } = useContributorStatus(courseuuid);
  const router = useRouter();
  const t = useTranslations('ActivityPage');
  const locale = useLocale();
  const format = useFormatter();
  const gamificationContext = useOptionalGamificationContext();
  const gamificationProfile = gamificationContext?.profile ?? null;
  const refetchGamification = gamificationContext?.refetch ?? (async () => {});

  // Helper to get relative time using next-intl
  const getRelativeTimeIntl = (date: Date) => {
    const now = new Date();
    return format.relativeTime(date, now);
  };

  // Add SWR for trail data
  const { data: trailData } = useSWR(`${getAPIUrl()}trail/org/${org?.id}/trail`, (url) =>
    swrFetcher(url, access_token),
  );

  const { allActivities, currentIndex } = useActivityPosition(course, activityid);

  // Get previous and next activities
  const prevActivity = currentIndex > 0 ? allActivities[currentIndex - 1] : null;
  const nextActivity = currentIndex < allActivities.length - 1 ? allActivities[currentIndex + 1] : null;

  const activityContent = useMemo(() => {
    if (!activity?.published || activity?.content?.paid_access === false) {
      return null;
    }

    switch (activity.activity_type) {
      case 'TYPE_DYNAMIC': {
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Canva
              content={getValidTiptapContent(activity.content)}
              activity={activity}
            />
          </Suspense>
        );
      }
      case 'TYPE_VIDEO': {
        return (
          <Suspense fallback={<LoadingFallback />}>
            <VideoActivity
              course={course}
              activity={activity}
            />
          </Suspense>
        );
      }
      case 'TYPE_DOCUMENT': {
        return (
          <Suspense fallback={<LoadingFallback />}>
            <DocumentPdfActivity
              course={course}
              activity={activity}
            />
          </Suspense>
        );
      }
      case 'TYPE_ASSIGNMENT': {
        return assignment?.assignment_uuid ? (
          <Suspense fallback={<LoadingFallback />}>
            <AssignmentProvider assignment_uuid={assignment.assignment_uuid}>
              <AssignmentsTaskProvider>
                <AssignmentSubmissionProvider assignment_uuid={assignment.assignment_uuid}>
                  <AssignmentStudentActivity />
                </AssignmentSubmissionProvider>
              </AssignmentsTaskProvider>
            </AssignmentProvider>
          </Suspense>
        ) : null;
      }
      default: {
        return null;
      }
    }
  }, [activity, course, assignment]);

  // Navigate to an activity
  const navigateToActivity = (activity: any) => {
    if (!activity) return;

    const cleanCourseUuid = course.course_uuid?.replace('course_', '');
    router.push(`${getUriWithOrg(orgslug, '')}/course/${cleanCourseUuid}/activity/${activity.cleanUuid}`);
  };

  // Initialize focus mode from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('globalFocusMode');
      setIsFocusMode(saved === 'true');
    }
  }, []);

  // Save focus mode to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('globalFocusMode', isFocusMode.toString());
      // Dispatch custom event for focus mode change
      window.dispatchEvent(
        new CustomEvent('focusModeChange', {
          detail: { isFocusMode },
        }),
      );
      isInitialRender.current = false;
    }
  }, [isFocusMode]);

  function getChapterNameByActivityId(course: any, activity_id: number) {
    for (let i = 0; i < course.chapters.length; i += 1) {
      const chapter = course.chapters[i];
      for (let j = 0; j < chapter.activities.length; j += 1) {
        const activity = chapter.activities[j];
        if (activity.id === activity_id) {
          return `${t('chapter')} ${i + 1} : ${chapter.name}`;
        }
      }
    }
    return null; // return null if no matching activity is found
  }
  const getAssignmentUI = useCallback(async () => {
    if (!activity?.activity_uuid) return;
    const assignment = await getAssignmentFromActivityUUID(activity.activity_uuid, access_token);
    setAssignment(assignment.data);
  }, [activity?.activity_uuid, access_token, setAssignment]);

  useEffect(() => {
    if (!activity) return;

    if (activity.activity_type === 'TYPE_DYNAMIC') {
      setBgColor(isFocusMode ? 'bg-white' : 'bg-white soft-shadow');
    } else if (activity.activity_type === 'TYPE_ASSIGNMENT') {
      setMarkStatusButtonActive(false);
      setBgColor(isFocusMode ? 'bg-white' : 'bg-white soft-shadow');
      getAssignmentUI();
    } else {
      setBgColor(isFocusMode ? 'bg-zinc-950' : 'bg-zinc-950 soft-shadow');
    }
  }, [activity, pathname, isFocusMode, getAssignmentUI]);

  return (
    <CourseProvider courseuuid={course?.course_uuid}>
      <Suspense fallback={<LoadingFallback />}>
        <AIChatBotProvider>
          {isFocusMode ? (
            <AnimatePresence>
              <motion.div
                initial={isInitialRender.current ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 z-50 bg-white"
              >
                {/* Focus Mode Top Bar */}
                <motion.div
                  initial={isInitialRender.current ? false : { y: -100 }}
                  animate={{ y: 0 }}
                  exit={{ y: -100 }}
                  transition={{ duration: 0.3 }}
                  className="fixed top-0 right-0 left-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-xl"
                >
                  <div className="container mx-auto px-4 py-2">
                    <div className="flex h-14 items-center justify-between">
                      {/* Progress Indicator - Moved to left */}
                      <motion.div
                        initial={isInitialRender.current ? false : { opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center space-x-2"
                      >
                        <div className="relative h-8 w-8">
                          <svg className="h-full w-full -rotate-90">
                            <circle
                              cx="16"
                              cy="16"
                              r="14"
                              stroke="#e5e7eb"
                              strokeWidth="3"
                              fill="none"
                            />
                            <circle
                              cx="16"
                              cy="16"
                              r="14"
                              stroke="#10b981"
                              strokeWidth="3"
                              fill="none"
                              strokeLinecap="round"
                              strokeDasharray={2 * Math.PI * 14}
                              strokeDashoffset={
                                2 *
                                Math.PI *
                                14 *
                                (1 -
                                  (trailData?.runs
                                    ?.find((run: any) => run.course_uuid === course.course_uuid)
                                    ?.steps?.filter((step: any) => step.complete)?.length || 0) /
                                    (course.chapters?.reduce(
                                      (acc: number, chapter: any) => acc + chapter.activities.length,
                                      0,
                                    ) || 1))
                              }
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-bold text-gray-800">
                              {Math.round(
                                ((trailData?.runs
                                  ?.find((run: any) => run.course_uuid === course.course_uuid)
                                  ?.steps?.filter((step: any) => step.complete)?.length || 0) /
                                  (course.chapters?.reduce(
                                    (acc: number, chapter: any) => acc + chapter.activities.length,
                                    0,
                                  ) || 1)) *
                                  100,
                              )}
                              %
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-600">
                          {trailData?.runs
                            ?.find((run: any) => run.course_uuid === course.course_uuid)
                            ?.steps?.filter((step: any) => step.complete)?.length || 0}{' '}
                          {t('of')}{' '}
                          {course.chapters?.reduce((acc: number, chapter: any) => acc + chapter.activities.length, 0) ||
                            0}
                        </div>
                      </motion.div>

                      {/* Center Course Info */}
                      <motion.div
                        initial={isInitialRender.current ? false : { opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="flex items-center space-x-4"
                      >
                        <div className="flex">
                          <Link href={`${getUriWithOrg(orgslug, '')}/course/${courseuuid}`}>
                            <img
                              className="h-[34px] w-[60px] rounded-md drop-shadow-md"
                              src={
                                course.thumbnail_image
                                  ? `${getCourseThumbnailMediaDirectory(
                                      org?.org_uuid,
                                      course.course_uuid,
                                      course.thumbnail_image,
                                    )}`
                                  : '/empty_thumbnail.webp'
                              }
                              alt=""
                            />
                          </Link>
                        </div>
                        <div className="flex flex-col -space-y-1">
                          <p className="text-sm font-bold text-gray-700">{t('courseTitle')} </p>
                          <h1 className="text-lg font-bold text-gray-950 first-letter:uppercase">{course.name}</h1>
                        </div>
                      </motion.div>

                      {/* Minimize and Chapters - Moved to right */}
                      <motion.div
                        initial={isInitialRender.current ? false : { opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center space-x-2"
                      >
                        <ActivityChapterDropdown
                          course={course}
                          currentActivityId={
                            activity?.activity_uuid
                              ? activity.activity_uuid.replace('activity_', '')
                              : activityid.replace('activity_', '')
                          }
                          orgslug={orgslug}
                          trailData={trailData}
                        />
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setIsFocusMode(false);
                          }}
                          className="soft-shadow cursor-pointer rounded-full bg-white p-2 hover:bg-gray-50"
                          title={t('exitFocusMode')}
                        >
                          <Minimize2
                            size={16}
                            className="text-gray-700"
                          />
                        </motion.button>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>

                {/* Focus Mode Content */}
                <div className="h-full overflow-auto pt-16 pb-20">
                  <div className="container mx-auto px-4">
                    {activity && activity.published === true ? (
                      activity.content.paid_access === false ? (
                        <PaidCourseActivityDisclaimer course={course} />
                      ) : (
                        <motion.div
                          initial={isInitialRender.current ? false : { scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.3 }}
                          className={`rounded-lg p-7 ${bgColor} mt-4`}
                        >
                          {/* Activity Types */}
                          <div>{activityContent}</div>
                        </motion.div>
                      )
                    ) : null}
                  </div>
                </div>

                {/* Focus Mode Bottom Bar */}
                {activity && activity.published === true && activity.content.paid_access !== false ? (
                  <motion.div
                    initial={isInitialRender.current ? false : { y: 100 }}
                    animate={{ y: 0 }}
                    exit={{ y: 100 }}
                    transition={{ duration: 0.3 }}
                    className="fixed right-0 bottom-0 left-0 z-50 border-t border-gray-100 bg-white/90 backdrop-blur-xl"
                  >
                    <div className="container mx-auto px-4">
                      <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              navigateToActivity(prevActivity);
                            }}
                            className={`flex cursor-pointer items-center space-x-1.5 rounded-md p-2 transition-all duration-200 ${
                              prevActivity ? 'text-gray-700' : 'cursor-not-allowed text-gray-400 opacity-50'
                            }`}
                            disabled={!prevActivity}
                            title={
                              prevActivity
                                ? t('previousActivityTooltip', {
                                    activityName: prevActivity.name,
                                  })
                                : t('noPreviousActivity')
                            }
                          >
                            <ChevronLeft
                              size={20}
                              className="shrink-0 text-gray-800"
                            />
                            <div className="flex flex-col items-start">
                              <span className="text-xs text-gray-500">{t('previous')}</span>
                              <span className="text-left text-sm font-semibold capitalize">
                                {prevActivity ? prevActivity.name : t('noPreviousActivity')}
                              </span>
                            </div>
                          </button>
                        </div>
                        <div className="flex items-center space-x-2">
                          <ActivityActions
                            activity={activity}
                            activityid={activityid}
                            course={course}
                            orgslug={orgslug}
                            assignment={assignment}
                            showNavigation={false}
                          />
                          <button
                            onClick={() => {
                              navigateToActivity(nextActivity);
                            }}
                            className={`flex cursor-pointer items-center space-x-1.5 rounded-md p-2 transition-all duration-200 ${
                              nextActivity ? 'text-gray-700' : 'cursor-not-allowed text-gray-400 opacity-50'
                            }`}
                            disabled={!nextActivity}
                            title={
                              nextActivity
                                ? t('nextActivityTooltip', {
                                    activityName: nextActivity.name,
                                  })
                                : t('noNextActivity')
                            }
                          >
                            <div className="flex flex-col items-end">
                              <span className="text-xs text-gray-500">{t('next')}</span>
                              <span className="text-right text-sm font-semibold capitalize">
                                {nextActivity ? nextActivity.name : t('noNextActivity')}
                              </span>
                            </div>
                            <ChevronRight
                              size={20}
                              className="shrink-0 text-gray-800"
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </motion.div>
            </AnimatePresence>
          ) : (
            <GeneralWrapperStyled>
              {/* Original non-focus mode UI */}
              {activityid === 'end' ? (
                <CourseEndView
                  courseName={course.name}
                  orgslug={orgslug}
                  courseUuid={course.course_uuid}
                  thumbnailImage={course.thumbnail_image}
                  course={course}
                  trailData={trailData}
                />
              ) : (
                <div className="space-y-4 pt-0">
                  <div className="pt-2">
                    <ActivityBreadcrumbs
                      course={course}
                      activity={activity}
                      orgslug={orgslug}
                    />
                    <div className="activity-info-section space-y-4 pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex space-x-6">
                          <div className="flex">
                            <Link href={`${getUriWithOrg(orgslug, '')}/course/${courseuuid}`}>
                              <img
                                className="h-[57px] w-[100px] rounded-md drop-shadow-md"
                                src={
                                  course.thumbnail_image
                                    ? `${getCourseThumbnailMediaDirectory(
                                        org?.org_uuid,
                                        course.course_uuid,
                                        course.thumbnail_image,
                                      )}`
                                    : '/empty_thumbnail.webp'
                                }
                                alt=""
                              />
                            </Link>
                          </div>
                          <div className="flex flex-col -space-y-1">
                            <p className="text-md font-bold text-gray-700">{t('courseTitle')} </p>
                            <h1 className="text-3xl font-bold text-gray-950 first-letter:uppercase">{course.name}</h1>
                          </div>
                        </div>
                      </div>

                      <ActivityIndicators
                        course_uuid={courseuuid}
                        current_activity={activityid}
                        orgslug={orgslug}
                        course={course}
                        enableNavigation
                        trailData={trailData}
                      />

                      <div className="flex w-full items-center justify-between">
                        <div className="flex flex-1/3 items-center space-x-3">
                          <div className="flex flex-col -space-y-1">
                            <p className="text-md font-bold text-gray-700">
                              {getChapterNameByActivityId(course, activity.id)}
                            </p>
                            <h1 className="text-2xl font-bold text-gray-950 first-letter:uppercase">{activity.name}</h1>
                            {/* Authors and Dates Section */}
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              {/* Avatars */}
                              {course.authors && course.authors.length > 0 ? (
                                <div className="flex -space-x-3">
                                  {course.authors
                                    .filter((a: any) => a.authorship_status === 'ACTIVE')
                                    .slice(0, 3)
                                    .map((author: any, idx: number) => (
                                      <div
                                        key={author.user.user_uuid}
                                        className="relative z-[${10-idx}]"
                                      >
                                        <UserAvatar
                                          size="sm"
                                          variant="outline"
                                          avatar_url={
                                            author.user.avatar_image
                                              ? getUserAvatarMediaDirectory(
                                                  author.user.user_uuid,
                                                  author.user.avatar_image,
                                                )
                                              : ''
                                          }
                                          predefined_avatar={author.user.avatar_image ? undefined : 'empty'}
                                          showProfilePopup
                                          userId={author.user.id}
                                        />
                                      </div>
                                    ))}
                                  {course.authors.filter((a: any) => a.authorship_status === 'ACTIVE').length > 3 && (
                                    <div className="z-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-neutral-100 text-xs font-medium text-neutral-600 shadow-sm">
                                      +{course.authors.filter((a: any) => a.authorship_status === 'ACTIVE').length - 3}
                                    </div>
                                  )}
                                </div>
                              ) : null}
                              {/* Author names */}
                              {course.authors && course.authors.length > 0 ? (
                                <div className="flex items-center gap-1 text-xs font-medium text-gray-700">
                                  {course.authors.filter((a: any) => a.authorship_status === 'ACTIVE').length > 1 && (
                                    <span>{t('coCreatedBy')} </span>
                                  )}
                                  {course.authors
                                    .filter((a: any) => a.authorship_status === 'ACTIVE')
                                    .slice(0, 2)
                                    .map((author: any, idx: number, arr: any[]) => (
                                      <span key={author.user.user_uuid}>
                                        {author.user.first_name && author.user.last_name
                                          ? `${author.user.first_name} ${author.user.last_name}`
                                          : `@${author.user.username}`}
                                        {idx === 0 && arr.length > 1 ? ' & ' : ''}
                                      </span>
                                    ))}
                                  {course.authors.filter((a: any) => a.authorship_status === 'ACTIVE').length > 2 && (
                                    <ToolTip
                                      content={
                                        <div className="p-2">
                                          {course.authors
                                            .filter((a: any) => a.authorship_status === 'ACTIVE')
                                            .slice(2)
                                            .map((author: any) => (
                                              <div
                                                key={author.user.user_uuid}
                                                className="py-1 text-sm text-white"
                                              >
                                                {author.user.first_name && author.user.last_name
                                                  ? `${author.user.first_name} ${author.user.last_name}`
                                                  : `@${author.user.username}`}
                                              </div>
                                            ))}
                                        </div>
                                      }
                                    >
                                      <div className="cursor-pointer rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 transition-colors duration-200 hover:bg-gray-200">
                                        +
                                        {course.authors.filter((a: any) => a.authorship_status === 'ACTIVE').length - 2}
                                      </div>
                                    </ToolTip>
                                  )}
                                </div>
                              ) : null}
                              {/* Dates */}
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>
                                  {t('createdOn')}{' '}
                                  {new Date(course.creation_date).toLocaleDateString(locale, {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                  })}
                                </span>
                                <span className="mx-1">•</span>
                                <span>
                                  {t('lastUpdated')}{' '}
                                  {getRelativeTimeIntl(
                                    new Date(course.updated_at || course.last_updated || course.creation_date),
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {activity && activity.published === true && activity.content.paid_access !== false ? (
                            <AuthenticatedClientElement checkMethod="authentication">
                              {activity.activity_type !== 'TYPE_ASSIGNMENT' && (
                                <>
                                  <AIActivityAsk activity={activity} />
                                  <ActivityChapterDropdown
                                    course={course}
                                    currentActivityId={
                                      activity.activity_uuid
                                        ? activity.activity_uuid.replace('activity_', '')
                                        : activityid.replace('activity_', '')
                                    }
                                    orgslug={orgslug}
                                    trailData={trailData}
                                  />
                                  {contributorStatus === 'ACTIVE' && activity.activity_type === 'TYPE_DYNAMIC' && (
                                    <Link
                                      href={`${getUriWithOrg(orgslug, '')}/course/${courseuuid}/activity/${activityid}/edit`}
                                      className="flex items-center space-x-2 rounded-full bg-emerald-600 p-2.5 px-5 text-white drop-shadow-md transition delay-150 duration-300 ease-in-out hover:cursor-pointer"
                                    >
                                      <Edit2 size={17} />
                                      <span className="text-xs font-bold">{t('contribute')}</span>
                                    </Link>
                                  )}
                                </>
                              )}
                            </AuthenticatedClientElement>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {activity && activity.published === false ? (
                      <div className="rounded-lg bg-gray-800 p-7 drop-shadow-xs">
                        <div className="text-white">
                          <h1 className="text-2xl font-bold">{t('activityNotPublished')}</h1>
                        </div>
                      </div>
                    ) : null}

                    {activity && activity.published === true ? (
                      activity.content.paid_access === false ? (
                        <PaidCourseActivityDisclaimer course={course} />
                      ) : (
                        <div className={`rounded-lg p-7 drop-shadow-xs ${bgColor} relative`}>
                          <button
                            onClick={() => {
                              setIsFocusMode(true);
                            }}
                            className="soft-shadow group pointer-events-auto absolute top-4 right-4 z-50 cursor-pointer overflow-hidden rounded-full bg-white/80 p-2 transition-all duration-200 hover:bg-white"
                            title={t('enterFocusMode')}
                          >
                            <div className="flex items-center">
                              <Maximize2
                                size={16}
                                className="text-gray-700"
                              />
                              <span className="w-0 text-xs font-bold whitespace-nowrap text-gray-700 opacity-0 transition-all duration-200 group-hover:ml-2 group-hover:w-auto group-hover:opacity-100">
                                {t('focusMode')}
                              </span>
                            </div>
                          </button>
                          {activityContent}
                        </div>
                      )
                    ) : null}

                    {/* Activity Actions below the content box */}
                    {activity && activity.published === true && activity.content.paid_access !== false ? (
                      <div className="mt-4 flex w-full items-center justify-between">
                        <div>
                          <PreviousActivityButton
                            course={course}
                            currentActivityId={activity.id}
                            orgslug={orgslug}
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <ActivityActions
                            activity={activity}
                            activityid={activityid}
                            course={course}
                            orgslug={orgslug}
                            assignment={assignment}
                            showNavigation={false}
                          />
                          <NextActivityButton
                            course={course}
                            currentActivityId={activity.id}
                            orgslug={orgslug}
                          />
                        </div>
                      </div>
                    ) : null}

                    {/* Fixed Activity Secondary Bar */}
                    {activity && activity.published === true && activity.content.paid_access !== false ? (
                      <FixedActivitySecondaryBar
                        course={course}
                        currentActivityId={activityid}
                        orgslug={orgslug}
                        activity={activity}
                      />
                    ) : null}

                    <div className="h-[100px]" />
                  </div>
                </div>
              )}
            </GeneralWrapperStyled>
          )}
        </AIChatBotProvider>
      </Suspense>
    </CourseProvider>
  );
};

export const MarkStatus = (props: {
  activity: any;
  activityid: string;
  course: any;
  orgslug: string;
  trailData: any;
  t: ReturnType<typeof useTranslations<'ActivityPage'>>;
}) => {
  const { t } = props;
  const router = useRouter();
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const [isLoading, setIsLoading] = useState(false);
  const [showMarkedTooltip, setShowMarkedTooltip] = useState(false);
  const [showUnmarkedTooltip, setShowUnmarkedTooltip] = useState(false);

  // Gamification state via unified context
  const gamificationContext = useOptionalGamificationContext();
  const gamificationProfile = gamificationContext?.profile ?? null;
  const refetchGamification = gamificationContext?.refetch ?? (async () => {});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const markedTooltipCount = localStorage.getItem('activity_marked_tooltip_count');
      const unmarkedTooltipCount = localStorage.getItem('activity_unmarked_tooltip_count');

      if (!markedTooltipCount || Number.parseInt(markedTooltipCount, 10) < 3) {
        setShowMarkedTooltip(true);
      }
      if (!unmarkedTooltipCount || Number.parseInt(unmarkedTooltipCount, 10) < 3) {
        setShowUnmarkedTooltip(true);
      }
    }
  }, []);

  const handleMarkedTooltipClose = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('activity_marked_tooltip_count', '3');
      setShowMarkedTooltip(false);
    }
  };

  const handleUnmarkedTooltipClose = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('activity_unmarked_tooltip_count', '3');
      setShowUnmarkedTooltip(false);
    }
  };

  const infoIcon = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
      />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );

  const areAllActivitiesCompleted = () => {
    const run = props.trailData?.runs?.find((run: any) => run.course_uuid === props.course.course_uuid);
    if (!run) return false;

    let totalActivities = 0;
    let completedActivities = 0;

    props.course.chapters.forEach((chapter: any) => {
      chapter.activities.forEach((activity: any) => {
        totalActivities += 1;
        const isCompleted = run.steps.find(
          (step: any) => step.activity_uuid === activity.activity_uuid && step.complete === true,
        );
        if (isCompleted) {
          completedActivities += 1;
        }
      });
    });

    return completedActivities >= totalActivities - 1;
  };

  async function markActivityAsCompleteFront() {
    try {
      const willCompleteAll = areAllActivitiesCompleted();
      const previousLevel = gamificationProfile?.level || 1;
      const previousXP = gamificationProfile?.total_xp || 0;
      setIsLoading(true);

      await markActivityAsComplete(
        props.orgslug,
        props.course.course_uuid,
        props.activity.activity_uuid,
        session.data?.tokens?.access_token,
      );

      await mutate(`${getAPIUrl()}trail/org/${org?.id}/trail`);

      // Show XP notification after a short delay to allow backend processing
      setTimeout(async () => {
        if (refetchGamification) {
          await refetchGamification();

          // Show a generic success message since we can't reliably get updated state here
          toast.success(`🔥 +25 XP за завершение "${props.activity.title}"!`, {
            style: {
              borderRadius: '8px',
              background: '#333',
              color: '#fff',
            },
          });
        }
      }, 1000);

      if (willCompleteAll) {
        const cleanCourseUuid = props.course.course_uuid.replace('course_', '');
        router.push(`${getUriWithOrg(props.orgslug, '')}/course/${cleanCourseUuid}/activity/end`);
      }
    } catch (error) {
      console.error('Error marking activity as complete:', error);
      toast.error(t('markCompleteError'));
    } finally {
      setIsLoading(false);
    }
  }

  async function unmarkActivityAsCompleteFront() {
    try {
      setIsLoading(true);
      await unmarkActivityAsComplete(
        props.orgslug,
        props.course.course_uuid,
        props.activity.activity_uuid,
        session.data?.tokens?.access_token,
      );

      await mutate(`${getAPIUrl()}trail/org/${org?.id}/trail`);
    } catch {
      toast.error(t('unmarkCompleteError'));
    } finally {
      setIsLoading(false);
    }
  }

  const isActivityCompleted = () => {
    // Clean up course UUID by removing 'course_' prefix if it exists
    const cleanCourseUuid = props.course.course_uuid?.replace('course_', '');

    const run = props.trailData?.runs?.find((run: any) => {
      const cleanRunCourseUuid = run.course?.course_uuid?.replace('course_', '');
      return cleanRunCourseUuid === cleanCourseUuid;
    });

    if (run) {
      // Find the step that matches the current activity
      return run.steps.find((step: any) => step.activity_id === props.activity.id && step.complete === true);
    }
    return false;
  };

  // Don't render until we have trail data
  if (!props.trailData) {
    return null;
  }

  return (
    <>
      {isActivityCompleted() ? (
        <div className="flex items-center space-x-2">
          <div className="relative">
            <ConfirmationModal
              confirmationButtonText={t('unmarkActivity')}
              confirmationMessage={t('unmarkConfirmation')}
              dialogTitle={t('unmarkDialogTitle')}
              dialogTrigger={
                <div className="soft-shadow flex flex-col rounded-md bg-teal-600 p-2.5 px-4 text-white transition delay-150 duration-300 ease-in-out hover:cursor-pointer">
                  <span className="mb-1 text-[10px] font-bold uppercase">{t('status')}</span>
                  <div className="flex items-center space-x-2">
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect
                        x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="2"
                      />
                      <path d="M7 12l3 3 7-7" />
                    </svg>
                    <span className="text-xs font-bold">{t('statusComplete')}</span>
                  </div>
                </div>
              }
              functionToExecute={unmarkActivityAsCompleteFront}
              status="warning"
            />
            {showMarkedTooltip ? (
              <MiniInfoTooltip
                icon={infoIcon}
                message={t('markStatus.unmarkTooltipMessage')}
                onClose={handleMarkedTooltipClose}
                iconColor="text-teal-600"
                iconSize={24}
                width="w-64"
              />
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex items-center space-x-2">
          <div className="relative">
            <div
              className={`${isLoading ? 'opacity-90' : ''} soft-shadow flex flex-col rounded-md bg-gray-800 p-2.5 px-4 text-white transition-all duration-200 hover:cursor-pointer ${isLoading ? 'cursor-not-allowed' : 'hover:bg-gray-700'}`}
              onClick={!isLoading ? markActivityAsCompleteFront : undefined}
            >
              <span className="mb-1 text-[10px] font-bold uppercase">{t('status')}</span>
              <div className="flex items-center space-x-2">
                {isLoading ? (
                  <div className="animate-spin">
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                  </div>
                ) : (
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect
                      x="3"
                      y="3"
                      width="18"
                      height="18"
                      rx="2"
                    />
                  </svg>
                )}
                <span className="min-w-[90px] text-xs font-bold">{isLoading ? t('marking') : t('markAsComplete')}</span>
              </div>
            </div>
            {showUnmarkedTooltip ? (
              <MiniInfoTooltip
                icon={infoIcon}
                message={t('markStatus.markTooltipMessage')}
                onClose={handleUnmarkedTooltipClose}
                iconColor="text-gray-600"
                iconSize={24}
                width="w-64"
              />
            ) : null}
          </div>
        </div>
      )}
    </>
  );
};

const NextActivityButton = ({
  course,
  currentActivityId,
  orgslug,
}: {
  course: any;
  currentActivityId: string;
  orgslug: string;
}) => {
  const router = useRouter();
  const t = useTranslations('ActivityPage');
  const isMobile = useIsMobile();

  const findNextActivity = () => {
    const allActivities: any[] = [];
    let currentIndex = -1;

    // Flatten all activities from all chapters
    course.chapters.forEach((chapter: any) => {
      chapter.activities.forEach((activity: any) => {
        const cleanActivityUuid = activity.activity_uuid?.replace('activity_', '');
        allActivities.push({
          ...activity,
          cleanUuid: cleanActivityUuid,
          chapterName: chapter.name,
        });

        // Check if this is the current activity
        if (activity.id === currentActivityId) {
          currentIndex = allActivities.length - 1;
        }
      });
    });

    // Get next activity
    return currentIndex < allActivities.length - 1 ? allActivities[currentIndex + 1] : null;
  };

  const nextActivity = findNextActivity();

  if (!nextActivity) return null;

  const navigateToActivity = () => {
    const cleanCourseUuid = course.course_uuid?.replace('course_', '');
    router.push(`${getUriWithOrg(orgslug, '')}/course/${cleanCourseUuid}/activity/${nextActivity.cleanUuid}`);
  };

  return (
    <div
      onClick={navigateToActivity}
      className="flex flex-col rounded-md bg-gray-200 p-2.5 px-4 text-gray-600 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] transition delay-150 duration-300 ease-in-out hover:cursor-pointer hover:bg-gray-200"
    >
      <span className="mb-1 text-[10px] font-bold text-gray-500 uppercase">{t('next')}</span>
      <div className="flex items-center space-x-1">
        <span className="max-w-[200px] truncate text-sm font-semibold">{nextActivity.name}</span>
        <ChevronRight size={17} />
      </div>
    </div>
  );
};

const PreviousActivityButton = ({
  course,
  currentActivityId,
  orgslug,
}: {
  course: any;
  currentActivityId: string;
  orgslug: string;
}) => {
  const router = useRouter();
  const isMobile = useIsMobile();
  const t = useTranslations('ActivityPage');

  const findPreviousActivity = () => {
    const allActivities: any[] = [];
    let currentIndex = -1;

    // Flatten all activities from all chapters
    course.chapters.forEach((chapter: any) => {
      chapter.activities.forEach((activity: any) => {
        const cleanActivityUuid = activity.activity_uuid?.replace('activity_', '');
        allActivities.push({
          ...activity,
          cleanUuid: cleanActivityUuid,
          chapterName: chapter.name,
        });

        // Check if this is the current activity
        if (activity.id === currentActivityId) {
          currentIndex = allActivities.length - 1;
        }
      });
    });

    // Get previous activity
    return currentIndex > 0 ? allActivities[currentIndex - 1] : null;
  };

  const previousActivity = findPreviousActivity();

  if (!previousActivity) return null;

  const navigateToActivity = () => {
    const cleanCourseUuid = course.course_uuid?.replace('course_', '');
    router.push(`${getUriWithOrg(orgslug, '')}/course/${cleanCourseUuid}/activity/${previousActivity.cleanUuid}`);
  };

  return (
    <div
      onClick={navigateToActivity}
      className="soft-shadow flex flex-col rounded-md bg-white p-2.5 px-4 text-gray-600 transition delay-150 duration-300 ease-in-out hover:cursor-pointer"
    >
      <span className="mb-1 text-[10px] font-bold text-gray-500 uppercase">{t('previous')}</span>
      <div className="flex items-center space-x-1">
        <ChevronLeft size={17} />
        <span className="max-w-[200px] truncate text-sm font-semibold">{previousActivity.name}</span>
      </div>
    </div>
  );
};

const AssignmentTools = (props: {
  activity: any;
  activityid: string;
  course: any;
  orgslug: string;
  assignment: any;
  t: ReturnType<typeof useTranslations<'ActivityPage'>>;
}) => {
  const submissionContext = useAssignmentSubmission();
  const submission = submissionContext.submissions;
  const session = useLHSession() as any;
  const [finalGrade, setFinalGrade] = useState(null) as any;
  const { t } = props;

  const submitForGradingUI = async () => {
    if (props.assignment) {
      const res = await submitAssignmentForGrading(
        props.assignment?.assignment_uuid,
        session.data?.tokens?.access_token,
      );
      if (res.success) {
        toast.success(t('submitSuccessToast'));
        mutate(`${getAPIUrl()}assignments/${props.assignment?.assignment_uuid}/submissions/me`);
      } else {
        toast.error(t('submitErrorToast'));
      }
    }
  };

  // Helper function to convert numeric grade to alphabet grade
  function convertNumericToAlphabet(grade: number, maxGrade: number) {
    const percentage = (grade / maxGrade) * 100;
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  }

  const getGradingBasedOnMethod = useCallback(async () => {
    const res = await getFinalGrade(
      session.data?.user?.id,
      props.assignment?.assignment_uuid,
      session.data?.tokens?.access_token,
    );

    if (res.success) {
      const { grade, max_grade, grading_type } = res.data;
      let displayGrade: string;

      switch (grading_type) {
        case 'ALPHABET': {
          displayGrade = convertNumericToAlphabet(grade, max_grade);
          break;
        }
        case 'NUMERIC': {
          displayGrade = `${grade}/${max_grade}`;
          break;
        }
        case 'PERCENTAGE': {
          const percentage = (grade / max_grade) * 100;
          displayGrade = `${percentage.toFixed(2)}%`;
          break;
        }
        default: {
          displayGrade = t('unknownGradingType');
        }
      } // Use displayGrade here, e.g., update state or display it
      setFinalGrade(displayGrade);
    }
  }, [session.data?.user?.id, props.assignment?.assignment_uuid, session.data?.tokens?.access_token, t, setFinalGrade]);

  useEffect(() => {
    if (submission && submission.length > 0 && submission[0]?.submission_status === 'GRADED') {
      getGradingBasedOnMethod();
    }
  }, [submission, props.assignment, getGradingBasedOnMethod]);

  if (!submission || submission.length === 0) {
    return (
      <ConfirmationModal
        confirmationButtonText={t('assignmentActions.submit')}
        confirmationMessage={t('assignmentActions.submitConfirm')}
        dialogTitle={t('assignmentActions.submitYourAssingmentForGrading')}
        dialogTrigger={
          <div className="soft-shadow flex flex-col rounded-md bg-cyan-800 p-2.5 px-4 text-white transition delay-150 duration-300 ease-in-out hover:cursor-pointer">
            <span className="mb-1 text-[10px] font-bold uppercase">{t('status')}</span>
            <div className="flex items-center space-x-2">
              <BookOpenCheck size={17} />
              <span className="text-xs font-bold">{t('assignmentActions.submitForGrading')}</span>
            </div>
          </div>
        }
        functionToExecute={submitForGradingUI}
        status="info"
      />
    );
  }

  // At this point, submission is guaranteed to be an array with at least one element
  const firstSubmission = (submission as AssignmentSubmission[])[0];

  if (firstSubmission?.submission_status === 'SUBMITTED') {
    return (
      <div className="soft-shadow flex flex-col rounded-md bg-amber-800 p-2.5 px-4 text-white transition delay-150 duration-300 ease-in-out">
        <span className="mb-1 text-[10px] font-bold uppercase">{t('status')}</span>
        <div className="flex items-center space-x-2">
          <UserRoundPen size={17} />
          <span className="text-xs font-bold">{t('assignmentStatus.grading')}</span>
        </div>
      </div>
    );
  }

  if (firstSubmission?.submission_status === 'GRADED') {
    return (
      <div className="soft-shadow flex flex-col rounded-md bg-teal-600 p-2.5 px-4 text-white transition delay-150 duration-300 ease-in-out">
        <span className="mb-1 text-[10px] font-bold uppercase">{t('status')}</span>
        <div className="flex items-center space-x-2">
          <CheckCircle size={17} />
          <span className="flex items-center space-x-2 text-xs font-bold">
            <span>{t('assignmentStatus.graded')}</span>
            <span className="rounded-md bg-white px-1 py-0.5 text-teal-800">{finalGrade}</span>
          </span>
        </div>
      </div>
    );
  }

  // Default return in case none of the conditions are met
  return null;
};

export default ActivityClient;
