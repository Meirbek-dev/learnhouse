'use client';
import { CourseProvider } from '@components/Contexts/CourseContext';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import CourseActionsMobile from '@components/Objects/Courses/CourseActions/CourseActionsMobile';
import CoursesActions from '@components/Objects/Courses/CourseActions/CoursesActions';
import CourseAuthors from '@components/Objects/Courses/CourseAuthors/CourseAuthors';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper';
import ActivityIndicators from '@components/Pages/Courses/ActivityIndicators';
import CourseBreadcrumbs from '@components/Pages/Courses/CourseBreadcrumbs';
import { getAPIUrl, getUriWithOrg } from '@services/config/config';
import { getCourseThumbnailMediaDirectory } from '@services/media/media';
import { swrFetcher } from '@services/utils/ts/requests';
import { ArrowRight, Backpack, Check, File, ImageIcon, Layers, Square, StickyNote, Video } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import { useIsMobile } from '@/hooks/useIsMobile';

const CourseClient = (props: any) => {
  const t = useTranslations('CoursePage');
  const [learnings, setLearnings] = useState<any>([]);
  const [expandedChapters, setExpandedChapters] = useState<{ [key: string]: boolean }>({});
  const [activeThumbnailType, setActiveThumbnailType] = useState<'image' | 'video'>('image');
  const { courseuuid } = props;
  const { orgslug } = props;
  const { course } = props;
  const org = useOrg() as any;
  const router = useRouter();
  const isMobile = useIsMobile();
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;

  // Add SWR for trail data
  const { data: trailData } = useSWR(`${getAPIUrl()}trail/org/${org?.id}/trail`, (url) =>
    swrFetcher(url, access_token),
  );

  console.log(course);

  const getLearningTags = useCallback(() => {
    if (!course?.learnings) {
      setLearnings([]);
      return;
    }

    try {
      // Try to parse as JSON (new format)
      const parsedLearnings = JSON.parse(course.learnings);
      if (Array.isArray(parsedLearnings)) {
        // New format: array of learning items with text and emoji
        setLearnings(parsedLearnings);
        return;
      }
    } catch {
      // Not valid JSON, continue to legacy format handling
    }

    // Legacy format: comma-separated string (changed from pipe-separated)
    const learningItems = course.learnings.split(',').map((text: string) => ({
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      text: text.trim(), // Trim whitespace that might be present after commas
      emoji: '📝', // Default emoji for legacy items
    }));

    setLearnings(learningItems);
  }, [course?.learnings]);

  useEffect(() => {
    getLearningTags();

    // Collapse chapters by default if more than 5 activities in total
    if (course?.chapters) {
      const totalActivities = course.chapters.reduce(
        (sum: number, chapter: any) => sum + (chapter.activities?.length || 0),
        0,
      );
      const defaultExpanded: { [key: string]: boolean } = {};
      course.chapters.forEach((chapter: any, idx: number) => {
        // Always expand the first chapter
        defaultExpanded[chapter.chapter_uuid] = idx === 0 ? true : totalActivities <= 5;
      });
      setExpandedChapters(defaultExpanded);
    }
  }, [org, course, getLearningTags]);

  const getActivityTypeLabel = (activityType: string) => {
    switch (activityType) {
      case 'TYPE_VIDEO':
        return t('video');
      case 'TYPE_DOCUMENT':
        return t('document');
      case 'TYPE_DYNAMIC':
        return t('page');
      case 'TYPE_ASSIGNMENT':
        return t('assignment');
      default:
        return t('learningMaterial');
    }
  };

  const getActivityTypeBadgeColor = (activityType: string) => {
    switch (activityType) {
      case 'TYPE_VIDEO':
        return 'bg-neutral-100 text-neutral-500';
      case 'TYPE_DOCUMENT':
        return 'bg-neutral-100 text-neutral-500';
      case 'TYPE_DYNAMIC':
        return 'bg-neutral-100 text-neutral-500';
      case 'TYPE_ASSIGNMENT':
        return 'bg-neutral-100 text-neutral-500';
      default:
        return 'bg-neutral-100 text-neutral-500';
    }
  };

  const isActivityDone = (activity: any) => {
    const cleanCourseUuid = course.course_uuid?.replace('course_', '');
    const run = trailData?.runs?.find((run: any) => {
      const cleanRunCourseUuid = run.course?.course_uuid?.replace('course_', '');
      return cleanRunCourseUuid === cleanCourseUuid;
    });
    if (run) {
      return run.steps.find((step: any) => step.activity_id === activity.id);
    }
    return false;
  };

  const isActivityCurrent = (activity: any) => {
    const activity_uuid = activity.activity_uuid.replace('activity_', '');
    return props.current_activity && props.current_activity === activity_uuid;
  };

  return (
    <>
      {!(course || org) ? (
        <PageLoading />
      ) : (
        <>
          <GeneralWrapperStyled>
            <CourseBreadcrumbs
              course={course}
              orgslug={orgslug}
            />
            <div className="flex flex-col items-start justify-between pb-2 pt-3 md:flex-row md:items-center">
              <div>
                <h1 className="text-3xl font-bold md:text-3xl">{course.name}</h1>
              </div>
            </div>

            <div className="flex flex-col gap-8 pt-2 md:flex-row">
              <div className="w-full space-y-4 md:w-3/4">
                {(() => {
                  const showVideo =
                    course.thumbnail_type === 'video' ||
                    (course.thumbnail_type === 'both' && activeThumbnailType === 'video');
                  const showImage =
                    course.thumbnail_type === 'image' ||
                    (course.thumbnail_type === 'both' && activeThumbnailType === 'image') ||
                    !course.thumbnail_type;

                  if (showVideo && course.thumbnail_video) {
                    return (
                      <div className="relative w-full overflow-hidden rounded-lg shadow-xl ring-1 ring-inset ring-black/10">
                        {course.thumbnail_type === 'both' && (
                          <div className="absolute right-3 top-3 z-10">
                            <div className="flex space-x-1 rounded-lg bg-black/20 p-1 backdrop-blur-sm">
                              <button
                                onClick={() => setActiveThumbnailType('image')}
                                className={`flex items-center rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                                  activeThumbnailType === 'image'
                                    ? 'bg-white/90 text-gray-900 shadow-sm'
                                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <ImageIcon
                                  size={12}
                                  className="mr-1"
                                />
                                {t('image')}
                              </button>
                              <button
                                onClick={() => setActiveThumbnailType('video')}
                                className={`flex items-center rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                                  activeThumbnailType === 'video'
                                    ? 'bg-white/90 text-gray-900 shadow-sm'
                                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <Video
                                  size={12}
                                  className="mr-1"
                                />
                                {t('video')}
                              </button>
                            </div>
                          </div>
                        )}
                        <video
                          src={getCourseThumbnailMediaDirectory(
                            org?.org_uuid,
                            course?.course_uuid,
                            course?.thumbnail_video,
                          )}
                          className="h-auto w-full rounded-lg bg-black object-contain"
                          controls
                          autoPlay
                          muted
                          preload="metadata"
                          playsInline
                        />
                      </div>
                    );
                  }
                  if (showImage && course.thumbnail_image) {
                    return (
                      <div className="relative w-full overflow-hidden rounded-lg shadow-xl ring-1 ring-inset ring-black/10">
                        <img
                          src={getCourseThumbnailMediaDirectory(
                            org?.org_uuid,
                            course?.course_uuid,
                            course?.thumbnail_image,
                          )}
                          alt={t('courseThumbnailAlt')}
                          className="h-auto w-full object-contain"
                        />
                        {course.thumbnail_type === 'both' && (
                          <div className="absolute right-3 top-3 z-10">
                            <div className="flex space-x-1 rounded-lg bg-black/20 p-1 backdrop-blur-sm">
                              <button
                                onClick={() => setActiveThumbnailType('image')}
                                className={`flex items-center rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                                  activeThumbnailType === 'image'
                                    ? 'bg-white/90 text-gray-900 shadow-sm'
                                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <ImageIcon
                                  size={12}
                                  className="mr-1"
                                />
                                {t('image')}
                              </button>
                              <button
                                onClick={() => setActiveThumbnailType('video')}
                                className={`flex items-center rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                                  activeThumbnailType === 'video'
                                    ? 'bg-white/90 text-gray-900 shadow-sm'
                                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <Video
                                  size={12}
                                  className="mr-1"
                                />
                                {t('video')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div
                      className="relative w-full overflow-hidden rounded-lg bg-cover bg-center shadow-xl ring-1 ring-inset ring-black/10"
                      style={{
                        backgroundImage: `url('../empty_thumbnail.png')`,
                        backgroundSize: 'auto',
                        height: 'auto',
                      }}
                    />
                  );
                })()}

                {(() => {
                  const cleanCourseUuid = course.course_uuid?.replace('course_', '');
                  const run = trailData?.runs?.find((run: any) => {
                    const cleanRunCourseUuid = run.course?.course_uuid?.replace('course_', '');
                    return cleanRunCourseUuid === cleanCourseUuid;
                  });
                  return run;
                })() && (
                  <ActivityIndicators
                    course_uuid={props.course.course_uuid}
                    orgslug={orgslug}
                    course={course}
                  />
                )}

                <div className="course_metadata_left space-y-2">
                  <div className="">
                    <p className="w-full hyphens-auto whitespace-pre-line text-pretty break-words py-5 leading-relaxed tracking-normal">
                      {course.about}
                    </p>
                  </div>
                </div>
              </div>

              <div className="course_metadata_right w-full space-y-4 md:w-1/4">
                {/* Actions Box */}
                <CoursesActions
                  courseuuid={courseuuid}
                  orgslug={orgslug}
                  course={course}
                  trailData={trailData}
                />

                {/* Authors & Updates Box */}
                <div className="overflow-hidden rounded-lg bg-white p-4 shadow-md shadow-gray-300/25 outline-1 outline-neutral-200/40">
                  <CourseProvider courseuuid={course.course_uuid}>
                    <CourseAuthors authors={course.authors} />
                  </CourseProvider>
                </div>
              </div>
            </div>

            {learnings.length > 0 && learnings[0]?.text !== 'null' && (
              <div className="w-full">
                <h2 className="py-5 text-xl font-semibold md:text-2xl">{t('whatYouWillLearn')}</h2>
                <div className="space-y-2 overflow-hidden rounded-lg bg-white px-5 py-5 shadow-md shadow-gray-300/25 outline-1 outline-neutral-200/40">
                  {learnings.map((learning: any) => {
                    // Handle both new format (object with text and emoji) and legacy format (string)
                    const learningText = typeof learning === 'string' ? learning : learning.text;
                    const learningEmoji = typeof learning === 'string' ? null : learning.emoji;
                    const learningId = typeof learning === 'string' ? learning : learning.id || learning.text;

                    if (!learningText) return null;

                    return (
                      <div
                        key={learningId}
                        className="flex items-center space-x-2 font-semibold text-gray-500"
                      >
                        <div className="rounded-full px-2 py-2">
                          {learningEmoji ? (
                            <span>{learningEmoji}</span>
                          ) : (
                            <Check
                              className="text-gray-400"
                              size={15}
                            />
                          )}
                        </div>
                        <p>{learningText}</p>
                        {learning.link && (
                          <a
                            href={learning.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-500 hover:underline"
                          >
                            <span className="sr-only">
                              {t('linkTo', {
                                learningText,
                              })}
                            </span>
                            <ArrowRight size={14} />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="my-5 mb-10 w-full">
              <h2 className="py-5 text-xl font-semibold md:text-2xl">{t('courseLessons')}</h2>
              <div className="overflow-hidden rounded-lg bg-white shadow-md shadow-gray-300/25 outline-1 outline-neutral-200/40">
                {course.chapters.map((chapter: any, idx: number) => {
                  const isExpanded = expandedChapters[chapter.chapter_uuid] ?? idx === 0; // Default to expanded for first chapter
                  return (
                    <div key={chapter.chapter_uuid || `chapter-${chapter.name}`}>
                      <div
                        className="flex cursor-pointer items-start bg-neutral-50 px-4 py-4 font-semibold text-neutral-600 outline-1 outline-neutral-200/40 transition-colors hover:bg-neutral-100"
                        onClick={() =>
                          setExpandedChapters((prev) => ({
                            ...prev,
                            [chapter.chapter_uuid]: !isExpanded,
                          }))
                        }
                      >
                        {/* Chevron on the far left, vertically centered with the title */}
                        <div className="mr-3 flex flex-col justify-center pt-1">
                          <svg
                            className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                        {/* Title and badge column */}
                        <div className="flex w-full flex-col items-start">
                          <div className="mb-1 flex w-full min-w-0 flex-wrap items-center">
                            {/* Numbered badge */}
                            <span className="mr-2 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-neutral-200 text-xs font-semibold text-neutral-600">
                              {idx + 1}
                            </span>
                            <h3
                              className="min-w-0 truncate text-lg font-semibold leading-tight sm:text-base md:text-lg"
                              style={{ lineHeight: '1.2' }}
                            >
                              {chapter.name}
                            </h3>
                          </div>
                          <div className="flex items-center space-x-1 text-sm font-normal text-neutral-400">
                            <Layers
                              size={16}
                              className="mr-1"
                            />
                            <span>
                              {t('activities', {
                                activitiesLength: chapter.activities.length,
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className={`transition-all duration-200 ${isExpanded ? 'block' : 'hidden'}`}>
                        <div className="">
                          {chapter.activities.map((activity: any) => {
                            return (
                              <Link
                                key={activity.activity_uuid}
                                href={`${getUriWithOrg(orgslug, '')}/course/${courseuuid}/activity/${activity.activity_uuid.replace('activity_', '')}`}
                                rel="noopener noreferrer"
                                prefetch={false}
                                className="activity-container group block px-4 py-4 transition-all duration-200"
                              >
                                <div className="flex items-center space-x-3">
                                  <div className="flex items-center">
                                    {isActivityDone(activity) ? (
                                      <div className="relative cursor-pointer">
                                        <Square
                                          size={16}
                                          className="stroke-[2] text-teal-600"
                                        />
                                        <Check
                                          size={16}
                                          className="absolute left-0 top-0 stroke-[2.5] text-teal-600"
                                        />
                                      </div>
                                    ) : (
                                      <div className="cursor-pointer text-neutral-300">
                                        <Square
                                          size={16}
                                          className="stroke-[2]"
                                        />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex grow flex-col">
                                    <div className="flex w-full items-center space-x-2">
                                      <p className="font-semibold text-neutral-600 transition-colors group-hover:text-neutral-800">
                                        {activity.name}
                                      </p>
                                      {isActivityCurrent(activity) && (
                                        <div className="flex animate-pulse items-center space-x-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
                                          <span>{t('current')}</span>
                                        </div>
                                      )}
                                    </div>
                                    <div className="mt-0.5 flex items-center space-x-1.5 text-neutral-400">
                                      {activity.activity_type === 'TYPE_DYNAMIC' && <StickyNote size={10} />}
                                      {activity.activity_type === 'TYPE_VIDEO' && <Video size={10} />}
                                      {activity.activity_type === 'TYPE_DOCUMENT' && <File size={10} />}
                                      {activity.activity_type === 'TYPE_ASSIGNMENT' && <Backpack size={10} />}
                                      <span className="text-xs font-medium">
                                        {getActivityTypeLabel(activity.activity_type)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="cursor-pointer text-neutral-300 transition-colors group-hover:text-neutral-400">
                                    <ArrowRight size={14} />
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </GeneralWrapperStyled>

          {/* Mobile Actions Box */}
          {isMobile && (
            <CourseActionsMobile
              courseuuid={courseuuid}
              orgslug={orgslug}
              course={course}
              trailData={trailData}
            />
          )}
        </>
      )}
    </>
  );
};

export default CourseClient;
