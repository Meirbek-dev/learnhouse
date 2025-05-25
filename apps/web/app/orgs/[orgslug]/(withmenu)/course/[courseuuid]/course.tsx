'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getUriWithOrg } from '@services/config/config'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import ActivityIndicators from '@components/Pages/Courses/ActivityIndicators'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import {
  ArrowRight,
  Backpack,
  Check,
  File,
  StickyNote,
  Video,
  Square,
} from 'lucide-react'
import { useOrg } from '@components/Contexts/OrgContext'
import { CourseProvider } from '@components/Contexts/CourseContext'
import CoursesActions from '@components/Objects/Courses/CourseActions/CoursesActions'
import CourseActionsMobile from '@components/Objects/Courses/CourseActions/CourseActionsMobile'
import CourseAuthors from '@components/Objects/Courses/CourseAuthors/CourseAuthors'
import { useTranslations } from 'next-intl'
import { useIsMobile } from '@/hooks/useIsMobile'

const CourseClient = (props: any) => {
  const t = useTranslations('CoursePage')
  const [learnings, setLearnings] = useState<any>([])
  const [expandedChapters, setExpandedChapters] = useState<{
    [key: string]: boolean
  }>({})
  const courseuuid = props.courseuuid
  const orgslug = props.orgslug
  const course = props.course
  const org = useOrg() as any
  const isMobile = useIsMobile()

  console.log(course)

  function getLearningTags() {
    if (!course?.learnings) {
      setLearnings([])
      return
    }

    try {
      // Try to parse as JSON (new format)
      const parsedLearnings = JSON.parse(course.learnings)
      if (Array.isArray(parsedLearnings)) {
        // New format: array of learning items with text and emoji
        setLearnings(parsedLearnings)
        return
      }
    } catch (_e) {
      // Not valid JSON, continue to legacy format handling
    }

    // Legacy format: comma-separated string (changed from pipe-separated)
    const learningItems = course.learnings.split(',').map((text: string) => ({
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      text: text.trim(), // Trim whitespace that might be present after commas
      emoji: '📝', // Default emoji for legacy items
    }))

    setLearnings(learningItems)
  }

  useEffect(() => {
    getLearningTags()

    // Collapse chapters by default if more than 5 activities in total
    if (course?.chapters) {
      const totalActivities = course.chapters.reduce(
        (sum: number, chapter: any) => sum + (chapter.activities?.length || 0),
        0
      )
      const defaultExpanded: { [key: string]: boolean } = {}
      course.chapters.forEach((chapter: any) => {
        defaultExpanded[chapter.chapter_uuid] = totalActivities <= 5
      })
      setExpandedChapters(defaultExpanded)
    }
  }, [org, course])

  const getActivityTypeLabel = (activityType: string) => {
    switch (activityType) {
      case 'TYPE_VIDEO':
        return 'Video'
      case 'TYPE_DOCUMENT':
        return 'Document'
      case 'TYPE_DYNAMIC':
        return 'Page'
      case 'TYPE_ASSIGNMENT':
        return 'Assignment'
      default:
        return 'Learning Material'
    }
  }

  const _getActivityTypeBadgeColor = (activityType: string) => {
    switch (activityType) {
      case 'TYPE_VIDEO':
        return 'bg-neutral-100 text-neutral-500'
      case 'TYPE_DOCUMENT':
        return 'bg-neutral-100 text-neutral-500'
      case 'TYPE_DYNAMIC':
        return 'bg-neutral-100 text-neutral-500'
      case 'TYPE_ASSIGNMENT':
        return 'bg-neutral-100 text-neutral-500'
      default:
        return 'bg-neutral-100 text-neutral-500'
    }
  }

  const isActivityDone = (activity: any) => {
    const run = course?.trail?.runs?.find(
      (run: any) => run.course_id == course.id
    )
    if (run) {
      return run.steps.find((step: any) => step.activity_id == activity.id)
    }
    return false
  }

  const isActivityCurrent = (activity: any) => {
    const activity_uuid = activity.activity_uuid.replace('activity_', '')
    return props.current_activity && props.current_activity == activity_uuid
  }

  return (
    <>
      {!(course || org) ? (
        <PageLoading />
      ) : (
        <>
          <GeneralWrapperStyled>
            <div className="flex flex-col items-start justify-between pb-2 pt-5 md:flex-row md:items-center">
              <div>
                <p className="text-md pb-2 font-bold text-gray-400">
                  {t('title')}
                </p>
                <h1 className="-mt-3 text-3xl font-bold md:text-3xl">
                  {course.name}
                </h1>
              </div>
            </div>

            <div className="flex flex-col gap-8 pt-2 md:flex-row">
              <div className="w-full space-y-4 md:w-3/4">
                {props.course?.thumbnail_image && org ? (
                  <div
                    className="relative inset-0 h-[200px] w-full rounded-lg bg-cover bg-center shadow-xl ring-1 ring-inset ring-black/10 md:h-[400px]"
                    style={{
                      backgroundImage: `url(${getCourseThumbnailMediaDirectory(
                        org?.org_uuid,
                        course?.course_uuid,
                        course?.thumbnail_image
                      )})`,
                    }}
                  />
                ) : (
                  <div
                    className="relative inset-0 h-[400px] w-full rounded-lg bg-cover bg-center shadow-xl ring-1 ring-inset ring-black/10"
                    style={{
                      backgroundImage: `url('../empty_thumbnail.png')`,
                      backgroundSize: 'auto',
                    }}
                  />
                )}

                {course?.trail?.runs?.find(
                  (run: any) => run.course_id == course.id
                ) && (
                  <ActivityIndicators
                    course_uuid={props.course.course_uuid}
                    orgslug={orgslug}
                    course={course}
                  />
                )}

                <div className="course_metadata_left space-y-2">
                  <div className="">
                    <p className="whitespace-pre-wrap py-5">{course.about}</p>
                  </div>
                </div>
              </div>

              <div className="course_metadata_right w-full space-y-4 md:w-1/4">
                {/* Actions Box */}
                <CoursesActions
                  courseuuid={courseuuid}
                  orgslug={orgslug}
                  course={course}
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
                <h2 className="py-5 text-xl font-bold md:text-2xl">
                  {t('whatYouWillLearn')}
                </h2>
                <div className="space-y-2 overflow-hidden rounded-lg bg-white px-5 py-5 shadow-md shadow-gray-300/25 outline-1 outline-neutral-200/40">
                  {learnings.map((learning: any) => {
                    // Handle both new format (object with text and emoji) and legacy format (string)
                    const learningText =
                      typeof learning === 'string' ? learning : learning.text
                    const learningEmoji =
                      typeof learning === 'string' ? null : learning.emoji
                    const learningId =
                      typeof learning === 'string'
                        ? learning
                        : learning.id || learning.text

                    if (!learningText) return null

                    return (
                      <div
                        key={learningId}
                        className="flex items-center space-x-2 font-semibold text-gray-500"
                      >
                        <div className="rounded-full px-2 py-2">
                          {learningEmoji ? (
                            <span>{learningEmoji}</span>
                          ) : (
                            <Check className="text-gray-400" size={15} />
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
                                learningText: learningText,
                              })}
                            </span>
                            <ArrowRight size={14} />
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="my-5 mb-10 w-full">
              <h2 className="py-5 text-xl font-bold md:text-2xl">
                {t('courseLessons')}
              </h2>
              <div className="overflow-hidden rounded-lg bg-white shadow-md shadow-gray-300/25 outline-1 outline-neutral-200/40">
                {course.chapters.map((chapter: any) => {
                  const isExpanded =
                    expandedChapters[chapter.chapter_uuid] ?? true // Default to expanded
                  return (
                    <div
                      key={chapter.chapter_uuid || `chapter-${chapter.name}`}
                      className=""
                    >
                      <div
                        className="flex cursor-pointer items-center bg-neutral-50 px-4 py-4 text-lg font-bold text-neutral-600 outline-1 outline-neutral-200/40 transition-colors hover:bg-neutral-100"
                        onClick={() =>
                          setExpandedChapters((prev) => ({
                            ...prev,
                            [chapter.chapter_uuid]: !isExpanded,
                          }))
                        }
                      >
                        <h3 className="mr-3 grow break-words">
                          {chapter.name}
                        </h3>
                        <div className="flex items-center space-x-3">
                          <p className="shrink-0 whitespace-nowrap rounded-full px-3 py-[2px] text-sm font-normal text-neutral-400 outline-1 outline-neutral-200">
                            {t('activities', {
                              activitiesLength: chapter.activities.length,
                            })}
                          </p>
                          <svg
                            className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
                      </div>
                      <div
                        className={`transition-all duration-200 ${isExpanded ? 'block' : 'hidden'}`}
                      >
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
                                      {activity.activity_type ===
                                        'TYPE_DYNAMIC' && (
                                        <StickyNote size={10} />
                                      )}
                                      {activity.activity_type ===
                                        'TYPE_VIDEO' && <Video size={10} />}
                                      {activity.activity_type ===
                                        'TYPE_DOCUMENT' && <File size={10} />}
                                      {activity.activity_type ===
                                        'TYPE_ASSIGNMENT' && (
                                        <Backpack size={10} />
                                      )}
                                      <span className="text-xs font-medium">
                                        {getActivityTypeLabel(
                                          activity.activity_type
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="cursor-pointer text-neutral-300 transition-colors group-hover:text-neutral-400">
                                    <ArrowRight size={14} />
                                  </div>
                                </div>
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </GeneralWrapperStyled>

          {isMobile && (
            <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
              <CourseActionsMobile
                courseuuid={courseuuid}
                orgslug={orgslug}
                course={course}
              />
            </div>
          )}
        </>
      )}
    </>
  )
}

export default CourseClient
