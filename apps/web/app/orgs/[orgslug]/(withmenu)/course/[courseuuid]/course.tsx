'use client';

// Import Lucide icons
import {
  ArrowRight,
  Backpack,
  Check,
  ChevronDown,
  File,
  ImageIcon,
  Layers,
  Square,
  StickyNote,
  Video,
} from 'lucide-react';
// Import custom components
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import CourseActionsMobile from '@components/Objects/Courses/CourseActions/CourseActionsMobile';
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper';
import CoursesActions from '@components/Objects/Courses/CourseActions/CoursesActions';
import CourseAuthors from '@components/Objects/Courses/CourseAuthors/CourseAuthors';
import ActivityIndicators from '@components/Pages/Courses/ActivityIndicators';
import CourseBreadcrumbs from '@components/Pages/Courses/CourseBreadcrumbs';
// Import existing components and utilities
import { getCourseThumbnailMediaDirectory } from '@services/media/media';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { getDiscussionsSwrKey } from '@services/courses/discussions';
import { CourseProvider } from '@components/Contexts/CourseContext';
import { getAPIUrl, getUriWithOrg } from '@services/config/config';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { useFormatter, useTranslations } from 'next-intl';
import { useOrg } from '@components/Contexts/OrgContext';
import { swrFetcher } from '@services/utils/ts/requests';
// Import the new discussions component
import CourseDiscussions from '@/components/discussions';
// Import UI components
import { Card, CardContent } from '@/components/ui/card';
import { useCallback, useEffect, useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import useSWR from 'swr';

const CourseClient = (props: any) => {
  const t = useTranslations('CoursePage');
  const format = useFormatter();
  const [learnings, setLearnings] = useState<any>([]);
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [activeThumbnailType, setActiveThumbnailType] = useState<'image' | 'video'>('image');

  const { courseuuid } = props;
  const { orgslug } = props;
  const { course } = props;
  const org = useOrg() as any;
  const isMobile = useIsMobile();
  const session = useLHSession();
  const access_token = session?.data?.tokens?.access_token;

  const {
    data: discussionPosts = [],
    error: discussionsError,
    mutate: mutateDiscussions,
  } = useSWR(
    course?.course_uuid && access_token ? getDiscussionsSwrKey(course.course_uuid, true, 50, 0) : null,
    (url) => swrFetcher(url, access_token),
  );

  // Add SWR for trail data
  const { data: trailData } = useSWR(`${getAPIUrl()}trail/org/${org?.id}/trail`, (url) =>
    swrFetcher(url, access_token),
  );

  const getLearningTags = useCallback(() => {
    if (!course?.learnings) {
      setLearnings([]);
      return;
    }
    // Try to parse as JSON (new format)
    const parsedLearnings = JSON.parse(course.learnings);
    if (Array.isArray(parsedLearnings)) {
      // New format: array of learning items with text and emoji
      setLearnings(parsedLearnings);
    }
  }, [course?.learnings]);

  useEffect(() => {
    getLearningTags();
    // Collapse chapters by default if more than 5 activities in total
    if (course?.chapters) {
      const totalActivities = course.chapters.reduce(
        (sum: number, chapter: any) => sum + (chapter.activities?.length || 0),
        0,
      );
      const defaultExpanded: Record<string, boolean> = {};
      course.chapters.forEach((chapter: any, idx: number) => {
        // Always expand the first chapter
        defaultExpanded[chapter.chapter_uuid] = idx === 0 ? true : totalActivities <= 5;
      });
      setExpandedChapters(defaultExpanded);
    }
  }, [org, course, getLearningTags]);

  const getActivityTypeLabel = (activityType: string) => {
    switch (activityType) {
      case 'TYPE_VIDEO': {
        return t('video');
      }
      case 'TYPE_DOCUMENT': {
        return t('document');
      }
      case 'TYPE_DYNAMIC': {
        return t('page');
      }
      case 'TYPE_ASSIGNMENT': {
        return t('assignment');
      }
      default: {
        return t('learningMaterial');
      }
    }
  };

  const isActivityDone = (activity: any) => {
    const cleanCourseUuid = course.course_uuid?.replace('course_', '');
    const run = trailData?.runs?.find((run: any) => {
      const cleanRunCourseUuid = run.course?.course_uuid?.replace('course_', '');
      return cleanRunCourseUuid === cleanCourseUuid;
    });
    if (run) {
      return run.steps.find((step: any) => step.activity_id === activity.id && step.complete === true);
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
            <div className="flex flex-col items-start justify-between pt-3 pb-2 md:flex-row md:items-center">
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
                      <div className="relative w-full overflow-hidden rounded-lg shadow-xl ring-1 ring-black/10 ring-inset">
                        {course.thumbnail_type === 'both' && (
                          <div className="absolute top-3 right-3 z-10">
                            <div className="flex space-x-1 rounded-lg bg-black/20 p-1 backdrop-blur-sm">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setActiveThumbnailType('image');
                                }}
                                className={cn(
                                  'h-8 px-2 text-xs',
                                  activeThumbnailType === 'image'
                                    ? 'bg-white/90 text-gray-900 shadow-sm'
                                    : 'text-white/80 hover:bg-white/10 hover:text-white',
                                )}
                              >
                                <ImageIcon
                                  size={12}
                                  className="mr-1"
                                />
                                {t('thumbnailTypeImage')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setActiveThumbnailType('video');
                                }}
                                className={cn(
                                  'h-8 px-2 text-xs',
                                  activeThumbnailType === 'video'
                                    ? 'bg-white/90 text-gray-900 shadow-sm'
                                    : 'text-white/80 hover:bg-white/10 hover:text-white',
                                )}
                              >
                                <Video
                                  size={12}
                                  className="mr-1"
                                />
                                {t('thumbnailTypeVideo')}
                              </Button>
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
                      <div className="relative w-full overflow-hidden rounded-lg shadow-xl ring-1 ring-black/10 ring-inset">
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
                          <div className="absolute top-3 right-3 z-10">
                            <div className="flex space-x-1 rounded-lg bg-black/20 p-1 backdrop-blur-sm">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setActiveThumbnailType('image');
                                }}
                                className={cn(
                                  'h-8 px-2 text-xs',
                                  activeThumbnailType === 'image'
                                    ? 'bg-white/90 text-gray-900 shadow-sm'
                                    : 'text-white/80 hover:bg-white/10 hover:text-white',
                                )}
                              >
                                <ImageIcon
                                  size={12}
                                  className="mr-1"
                                />
                                {t('thumbnailTypeImage')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setActiveThumbnailType('video');
                                }}
                                className={cn(
                                  'h-8 px-2 text-xs',
                                  activeThumbnailType === 'video'
                                    ? 'bg-white/90 text-gray-900 shadow-sm'
                                    : 'text-white/80 hover:bg-white/10 hover:text-white',
                                )}
                              >
                                <Video
                                  size={12}
                                  className="mr-1"
                                />
                                {t('thumbnailTypeVideo')}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div
                      className="relative h-auto w-full overflow-hidden rounded-lg bg-cover bg-center shadow-xl ring-1 ring-black/10 ring-inset"
                      style={{
                        backgroundImage: `url('../empty_thumbnail.webp')`,
                        backgroundSize: 'auto',
                      }}
                    />
                  );
                })()}
                {(() => {
                  const cleanCourseUuid = course.course_uuid?.replace('course_', '');
                  return trailData?.runs?.find((run: any) => {
                    const cleanRunCourseUuid = run.course?.course_uuid?.replace('course_', '');
                    return cleanRunCourseUuid === cleanCourseUuid;
                  });
                })() && (
                  <ActivityIndicators
                    course_uuid={props.course.course_uuid}
                    orgslug={orgslug}
                    course={course}
                    trailData={trailData}
                  />
                )}
                <div className="course_metadata_left space-y-2">
                  <div>
                    <p className="w-full py-5 leading-relaxed tracking-normal text-pretty break-words hyphens-auto whitespace-pre-line">
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
                <Card className="p-0">
                  <CardContent className="p-4">
                    <CourseProvider courseuuid={course.course_uuid}>
                      <CourseAuthors authors={course.authors} />
                    </CourseProvider>
                  </CardContent>
                </Card>
              </div>
            </div>
            {learnings.length > 0 && learnings[0]?.text !== 'null' && (
              <div className="w-full">
                <h2 className="py-5 text-xl font-semibold md:text-2xl">{t('whatYouWillLearn')}</h2>
                <Card className="p-0">
                  <CardContent className="space-y-2 p-5">
                    {learnings.map((learning: any) => {
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
                          {learning.link ? (
                            <Button
                              variant="link"
                              size="sm"
                              asChild
                            >
                              <a
                                href={learning.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm"
                              >
                                <span className="sr-only">{t('linkTo', { learningText })}</span>
                                <ArrowRight size={14} />
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            )}
            <div className="my-5 mb-10 w-full">
              <h2 className="pb-5 text-xl font-semibold md:text-2xl">{t('courseLessons')}</h2>
              <Card className="p-0">
                {course.chapters.map((chapter: any, idx: number) => {
                  const isExpanded = expandedChapters[chapter.chapter_uuid] ?? idx === 0;
                  return (
                    <Collapsible
                      key={chapter.chapter_uuid || `chapter-${chapter.name}`}
                      open={isExpanded}
                      onOpenChange={(open) => {
                        setExpandedChapters((prev) => ({
                          ...prev,
                          [chapter.chapter_uuid]: open,
                        }));
                      }}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex cursor-pointer items-start bg-neutral-50 px-4 py-4 font-semibold text-neutral-600 transition-colors hover:bg-neutral-100">
                          <div className="mr-3 flex flex-col justify-center pt-1">
                            <ChevronDown
                              className={cn('h-5 w-5 transition-transform', isExpanded ? 'rotate-180' : '')}
                            />
                          </div>
                          <div className="flex w-full flex-col items-start">
                            <div className="mb-1 flex w-full min-w-0 flex-wrap items-center">
                              <Badge
                                variant="secondary"
                                className="mr-2 h-5 w-5 rounded-full p-0 text-xs"
                              >
                                {idx + 1}
                              </Badge>
                              <h3 className="min-w-0 truncate text-lg leading-tight font-semibold">{chapter.name}</h3>
                            </div>
                            <div className="flex items-center space-x-1 text-sm font-normal text-neutral-400">
                              <Layers
                                size={16}
                                className="mr-1"
                              />
                              <span>{t('activitiesCount', { count: chapter.activities.length })}</span>
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div>
                          {chapter.activities.map((activity: any) => {
                            return (
                              <Link
                                key={activity.activity_uuid}
                                href={`${getUriWithOrg(orgslug, '')}/course/${courseuuid}/activity/${activity.activity_uuid.replace('activity_', '')}`}
                                rel="noopener noreferrer"
                                prefetch={false}
                                className="activity-container group block px-4 py-4 transition-all duration-200 hover:bg-gray-50"
                              >
                                <div className="flex items-center space-x-3">
                                  <div className="flex items-center">
                                    {isActivityDone(activity) ? (
                                      <div className="relative">
                                        <Square
                                          size={16}
                                          className="stroke-[2] text-teal-600"
                                        />
                                        <Check
                                          size={16}
                                          className="absolute top-0 left-0 stroke-[2.5] text-teal-600"
                                        />
                                      </div>
                                    ) : (
                                      <Square
                                        size={16}
                                        className="stroke-[2] text-neutral-300"
                                      />
                                    )}
                                  </div>
                                  <div className="flex grow flex-col">
                                    <div className="flex w-full items-center space-x-2">
                                      <p className="font-semibold text-neutral-600 transition-colors group-hover:text-neutral-800">
                                        {activity.name}
                                      </p>
                                      {isActivityCurrent(activity) && (
                                        <Badge
                                          variant="secondary"
                                          className="text-primary-foreground animate-pulse bg-blue-50"
                                        >
                                          {t('current')}
                                        </Badge>
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
                                  <div className="text-neutral-300 transition-colors group-hover:text-neutral-400">
                                    <ArrowRight size={14} />
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                      {idx < course.chapters.length - 1 && <Separator />}
                    </Collapsible>
                  );
                })}
              </Card>
            </div>

            {/* Course Discussions - Using the new component */}
            <CourseDiscussions
              initialPosts={discussionPosts}
              currentUser={session?.data?.user}
              courseUuid={course?.course_uuid}
              onMutate={mutateDiscussions}
            />
          </GeneralWrapperStyled>
          {/* Mobile Actions Box */}
          {isMobile ? (
            <CourseActionsMobile
              courseuuid={courseuuid}
              orgslug={orgslug}
              course={course}
              trailData={trailData}
            />
          ) : null}
        </>
      )}
    </>
  );
};

export default CourseClient;
