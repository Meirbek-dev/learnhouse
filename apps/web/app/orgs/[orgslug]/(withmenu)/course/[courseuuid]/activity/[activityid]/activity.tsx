'use client'
import Link from 'next/link'
import { getAPIUrl, getUriWithOrg } from '@services/config/config'
import Canva from '@components/Objects/Activities/DynamicCanva/DynamicCanva'
import VideoActivity from '@components/Objects/Activities/Video/Video'
import {
  BookOpenCheck,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Folder,
  MoreVertical,
  UserRoundPen,
  Video,
  Layers,
  ListTree,
  X,
  Edit2,
} from 'lucide-react'
import { markActivityAsComplete } from '@services/courses/activity'
import DocumentPdfActivity from '@components/Objects/Activities/DocumentPdf/DocumentPdf'
import ActivityIndicators from '@components/Pages/Courses/ActivityIndicators'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { usePathname, useRouter } from 'next/navigation'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import { useOrg } from '@components/Contexts/OrgContext'
import { CourseProvider } from '@components/Contexts/CourseContext'
import AIActivityAsk from '@components/Objects/Activities/AI/AIActivityAsk'
import AIChatBotProvider from '@components/Contexts/AI/AIChatBotContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useEffect } from 'react'
import * as React from 'react'
import {
  getAssignmentFromActivityUUID,
  getFinalGrade,
  submitAssignmentForGrading,
} from '@services/courses/assignments'
import AssignmentStudentActivity from '@components/Objects/Activities/Assignment/AssignmentStudentActivity'
import { AssignmentProvider } from '@components/Contexts/Assignments/AssignmentContext'
import { AssignmentsTaskProvider } from '@components/Contexts/Assignments/AssignmentsTaskContext'
import AssignmentSubmissionProvider, {
  useAssignmentSubmission,
} from '@components/Contexts/Assignments/AssignmentSubmissionContext'
import toast from 'react-hot-toast'
import { mutate } from 'swr'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import { useMediaQuery } from 'usehooks-ts'
import PaidCourseActivityDisclaimer from '@components/Objects/Courses/CourseActions/PaidCourseActivityDisclaimer'
import { useContributorStatus } from '../../../../../../../../hooks/useContributorStatus'
import { useTranslations } from 'next-intl'

interface ActivityClientProps {
  activityid: string
  courseuuid: string
  orgslug: string
  activity: any
  course: any
}

function ActivityClient(props: ActivityClientProps) {
  const t = useTranslations('ActivityPage')
  const activityid = props.activityid
  const courseuuid = props.courseuuid
  const orgslug = props.orgslug
  const activity = props.activity
  const course = props.course
  const org = useOrg() as any
  const session = useLHSession() as any
  const pathname = usePathname()
  const access_token = session?.data?.tokens?.access_token
  const [bgColor, setBgColor] = React.useState('bg-white')
  const [assignment, setAssignment] = React.useState(null) as any
  const [markStatusButtonActive, setMarkStatusButtonActive] =
    React.useState(false)
  const { contributorStatus } = useContributorStatus(courseuuid)

  function getChapterNameByActivityId(course: any, activity_id: any) {
    for (let i = 0; i < course.chapters.length; i++) {
      let chapter = course.chapters[i]
      for (let j = 0; j < chapter.activities.length; j++) {
        let activity = chapter.activities[j]
        if (activity.id === activity_id) {
          return chapter.name
        }
      }
    }
    return null // return null if no matching activity is found
  }

  async function getAssignmentUI() {
    const assignment = await getAssignmentFromActivityUUID(
      activity.activity_uuid,
      access_token
    )
    setAssignment(assignment.data)
  }

  useEffect(() => {
    if (activity.activity_type == 'TYPE_DYNAMIC') {
      setBgColor('bg-white nice-shadow')
    } else if (activity.activity_type == 'TYPE_ASSIGNMENT') {
      setMarkStatusButtonActive(false)
      setBgColor('bg-white nice-shadow')
      getAssignmentUI()
    } else {
      setBgColor('bg-zinc-950')
    }
  }, [activity, pathname])

  return (
    <>
      <CourseProvider courseuuid={course?.course_uuid}>
        <AIChatBotProvider>
          <GeneralWrapperStyled>
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex space-x-6">
                  <div className="flex">
                    <Link
                      href={
                        getUriWithOrg(orgslug, '') + `/course/${courseuuid}`
                      }
                    >
                      <img
                        className="h-[57px] w-[100px] rounded-md drop-shadow-md"
                        src={`${getCourseThumbnailMediaDirectory(
                          org?.org_uuid,
                          course.course_uuid,
                          course.thumbnail_image
                        )}`}
                        alt=""
                      />
                    </Link>
                  </div>
                  <div className="flex flex-col -space-y-1">
                    <p className="text-md font-bold text-gray-700">
                      {t('course')}{' '}
                    </p>
                    <h1 className="text-2xl font-bold text-gray-950 first-letter:uppercase">
                      {course.name}
                    </h1>
                  </div>
                </div>
              </div>
              <ActivityIndicators
                course_uuid={courseuuid}
                current_activity={activityid}
                orgslug={orgslug}
                course={course}
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <ActivityChapterDropdown
                    course={course}
                    currentActivityId={
                      activity.activity_uuid
                        ? activity.activity_uuid.replace('activity_', '')
                        : activityid.replace('activity_', '')
                    }
                    orgslug={orgslug}
                    t={t}
                  />
                  <div className="flex flex-col -space-y-1">
                    <p className="text-md font-bold text-gray-700">
                      {t('courseLessons')} :{' '}
                      {getChapterNameByActivityId(course, activity.id)}
                    </p>
                    <h1 className="text-2xl font-bold text-gray-950 first-letter:uppercase">
                      {activity.name}
                    </h1>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {activity &&
                    activity.published == true &&
                    activity.content.paid_access != false && (
                      <AuthenticatedClientElement checkMethod="authentication">
                        {activity.activity_type != 'TYPE_ASSIGNMENT' && (
                          <>
                            <AIActivityAsk activity={activity} />
                            {contributorStatus === 'ACTIVE' &&
                              activity.activity_type == 'TYPE_DYNAMIC' && (
                                <Link
                                  href={
                                    getUriWithOrg(orgslug, '') +
                                    `/course/${courseuuid}/activity/${activityid}/edit`
                                  }
                                  className="flex items-center space-x-2 rounded-full bg-emerald-600 p-2.5 px-5 text-white drop-shadow-md transition delay-150 duration-300 ease-in-out hover:cursor-pointer"
                                >
                                  <Edit2 size={17} />
                                  <span className="text-xs font-bold">
                                    {t('contributeToActivity')}
                                  </span>
                                </Link>
                              )}
                            <MoreVertical size={17} className="text-gray-300" />
                            <MarkStatus
                              activity={activity}
                              activityid={activityid}
                              course={course}
                              orgslug={orgslug}
                              t={t}
                            />
                          </>
                        )}
                        {activity.activity_type == 'TYPE_ASSIGNMENT' && (
                          <>
                            <MoreVertical size={17} className="text-gray-300" />
                            <AssignmentSubmissionProvider
                              assignment_uuid={assignment?.assignment_uuid}
                            >
                              <AssignmentTools
                                assignment={assignment}
                                activity={activity}
                                activityid={activityid}
                                course={course}
                                orgslug={orgslug}
                                t={t}
                              />
                            </AssignmentSubmissionProvider>
                          </>
                        )}
                      </AuthenticatedClientElement>
                    )}
                </div>
              </div>
              {activity && activity.published == false && (
                <div className="rounded-lg bg-gray-800 p-7 drop-shadow-xs">
                  <div className="text-white">
                    <h1 className="text-2xl font-bold">
                      {t('unpublishedActivity')}
                    </h1>
                  </div>
                </div>
              )}

              {activity && activity.published == true && (
                <>
                  {activity.content.paid_access == false ? (
                    <PaidCourseActivityDisclaimer course={course} />
                  ) : (
                    <div className={`rounded-lg p-7 drop-shadow-xs ${bgColor}`}>
                      {/* Activity Types */}
                      <div>
                        {activity.activity_type == 'TYPE_DYNAMIC' && (
                          <Canva
                            content={activity.content}
                            activity={activity}
                          />
                        )}
                        {activity.activity_type == 'TYPE_VIDEO' && (
                          <VideoActivity course={course} activity={activity} />
                        )}
                        {activity.activity_type == 'TYPE_DOCUMENT' && (
                          <DocumentPdfActivity
                            course={course}
                            activity={activity}
                          />
                        )}
                        {activity.activity_type == 'TYPE_ASSIGNMENT' && (
                          <div>
                            {assignment ? (
                              <AssignmentProvider
                                assignment_uuid={assignment?.assignment_uuid}
                              >
                                <AssignmentsTaskProvider>
                                  <AssignmentSubmissionProvider
                                    assignment_uuid={
                                      assignment?.assignment_uuid
                                    }
                                  >
                                    <AssignmentStudentActivity />
                                  </AssignmentSubmissionProvider>
                                </AssignmentsTaskProvider>
                              </AssignmentProvider>
                            ) : (
                              <div></div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Activity Navigation */}
              {activity &&
                activity.published == true &&
                activity.content.paid_access != false && (
                  <ActivityNavigation
                    course={course}
                    currentActivityId={
                      activity.activity_uuid
                        ? activity.activity_uuid.replace('activity_', '')
                        : activityid.replace('activity_', '')
                    }
                    orgslug={orgslug}
                    t={t}
                  />
                )}

              {<div style={{ height: '100px' }}></div>}
            </div>
          </GeneralWrapperStyled>
        </AIChatBotProvider>
      </CourseProvider>
    </>
  )
}

interface MarkStatusProps {
  activity: any
  activityid: string
  course: any
  orgslug: string
  t: ReturnType<typeof useTranslations<'ActivityPage'>>
}

export function MarkStatus(props: MarkStatusProps) {
  const router = useRouter()
  const session = useLHSession() as any
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [isLoading, setIsLoading] = React.useState(false)

  async function markActivityAsCompleteFront() {
    try {
      setIsLoading(true)
      const trail = await markActivityAsComplete(
        props.orgslug,
        props.course.course_uuid,
        props.activity.activity_uuid,
        session.data?.tokens?.access_token
      )

      // Mutate the course data to trigger re-render
      await mutate(`${getAPIUrl()}courses/${props.course.course_uuid}/meta`)
      router.refresh()
    } catch (error) {
      toast.error('Failed to mark activity as complete')
    } finally {
      setIsLoading(false)
    }
  }

  const isActivityCompleted = () => {
    let run = props.course.trail.runs.find(
      (run: any) => run.course_id == props.course.id
    )
    if (run) {
      return run.steps.find(
        (step: any) =>
          step.activity_id == props.activity.id && step.complete == true
      )
    }
  }

  return (
    <>
      {isActivityCompleted() ? (
        <div className="flex items-center space-x-2 rounded-full bg-teal-600 p-2.5 px-5 text-white drop-shadow-md transition delay-150 duration-300 ease-in-out hover:cursor-pointer">
          <i>
            <Check size={17}></Check>
          </i>{' '}
          <i className="text-xs font-bold not-italic">
            {props.t('statusComplete')}
          </i>
        </div>
      ) : (
        <div
          className={`${isLoading ? 'cursor-not-allowed opacity-75' : ''} flex items-center space-x-2 rounded-full bg-gray-800 p-2.5 px-5 text-white drop-shadow-md transition delay-150 duration-300 ease-in-out hover:cursor-pointer`}
          onClick={!isLoading ? markActivityAsCompleteFront : undefined}
        >
          {isLoading ? (
            <div className="animate-spin">
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
          ) : (
            <i>
              <Check size={17}></Check>
            </i>
          )}{' '}
          {!isMobile && (
            <i className="text-xs font-bold not-italic">
              {isLoading ? props.t('marking') : props.t('markAsComplete')}
            </i>
          )}
        </div>
      )}
    </>
  )
}

interface AssignmentToolsProps {
  activity: any
  activityid: string
  course: any
  orgslug: string
  assignment: any
  t: ReturnType<typeof useTranslations<'ActivityPage'>>
}

function AssignmentTools(props: AssignmentToolsProps) {
  const submission = useAssignmentSubmission() as any
  const session = useLHSession() as any
  const [finalGrade, setFinalGrade] = React.useState(null) as any
  const t = props.t

  const submitForGradingUI = async () => {
    if (props.assignment) {
      const res = await submitAssignmentForGrading(
        props.assignment?.assignment_uuid,
        session.data?.tokens?.access_token
      )
      if (res.success) {
        toast.success(t('submitSuccessToast'))
        mutate(
          `${getAPIUrl()}assignments/${props.assignment?.assignment_uuid}/submissions/me`
        )
      } else {
        toast.error(t('submitErrorToast'))
      }
    }
  }

  const getGradingBasedOnMethod = async () => {
    const res = await getFinalGrade(
      session.data?.user?.id,
      props.assignment?.assignment_uuid,
      session.data?.tokens?.access_token
    )

    if (res.success) {
      const { grade, max_grade, grading_type } = res.data
      let displayGrade

      switch (grading_type) {
        case 'ALPHABET':
          displayGrade = convertNumericToAlphabet(grade, max_grade)
          break
        case 'NUMERIC':
          displayGrade = `${grade}/${max_grade}`
          break
        case 'PERCENTAGE':
          const percentage = (grade / max_grade) * 100
          displayGrade = `${percentage.toFixed(2)}%`
          break
        default:
          displayGrade = t('unknownGradingType')
      }

      // Use displayGrade here, e.g., update state or display it
      setFinalGrade(displayGrade)
    } else {
    }
  }

  // Helper function to convert numeric grade to alphabet grade
  function convertNumericToAlphabet(grade: any, maxGrade: any) {
    const percentage = (grade / maxGrade) * 100
    if (percentage >= 90) return 'A'
    if (percentage >= 80) return 'B'
    if (percentage >= 70) return 'C'
    if (percentage >= 60) return 'D'
    return 'F'
  }

  useEffect(() => {
    if (
      submission &&
      submission.length > 0 &&
      submission[0].submission_status === 'GRADED'
    ) {
      getGradingBasedOnMethod()
    }
  }, [submission, props.assignment])

  if (!submission || submission.length === 0) {
    return (
      <ConfirmationModal
        confirmationButtonText={t('assignmentActions.submit')}
        confirmationMessage={t('assignmentActions.submitConfirm')}
        dialogTitle={t('assignmentActions.submitYourAssingmentForGrading')}
        dialogTrigger={
          <div className="flex items-center space-x-2 rounded-full bg-cyan-800 p-2.5 px-5 text-white drop-shadow-md transition delay-150 duration-300 ease-in-out hover:cursor-pointer">
            <BookOpenCheck size={17} />
            <span className="text-xs font-bold">
              {t('assignmentActions.submitForGrading')}
            </span>
          </div>
        }
        functionToExecute={submitForGradingUI}
        status="info"
      />
    )
  }

  if (submission[0].submission_status === 'SUBMITTED') {
    return (
      <div className="flex items-center space-x-2 rounded-full bg-amber-800 p-2.5 px-5 text-white drop-shadow-md transition delay-150 duration-300 ease-in-out">
        <UserRoundPen size={17} />
        <span className="text-xs font-bold">
          {t('assignmentStatus.grading')}
        </span>
      </div>
    )
  }

  if (submission[0].submission_status === 'GRADED') {
    return (
      <div className="flex items-center space-x-2 rounded-full bg-teal-600 p-2.5 px-5 text-white drop-shadow-md transition delay-150 duration-300 ease-in-out">
        <CheckCircle size={17} />
        <span className="flex items-center space-x-2 text-xs font-bold">
          <span>{t('assignmentStatus.graded')}</span>{' '}
          <span className="rounded-md bg-white px-1 py-0.5 text-teal-800">
            {finalGrade}
          </span>
        </span>
      </div>
    )
  }

  return null
}

interface ActivityChapterDropdownProps {
  course: any
  currentActivityId: string
  orgslug: string
  t: ReturnType<typeof useTranslations<'ActivityPage'>>
}

function ActivityChapterDropdown(
  props: ActivityChapterDropdownProps
): React.ReactNode {
  const [isOpen, setIsOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const isMobile = useMediaQuery('(max-width: 768px)')
  const t = props.t

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const toggleDropdown = () => {
    setIsOpen(!isOpen)
  }

  // Function to get the appropriate icon for activity type
  const getActivityTypeIcon = (activityType: string) => {
    switch (activityType) {
      case 'TYPE_VIDEO':
        return <Video size={16} />
      case 'TYPE_DOCUMENT':
        return <FileText size={16} />
      case 'TYPE_DYNAMIC':
        return <Layers size={16} />
      case 'TYPE_ASSIGNMENT':
        return <BookOpenCheck size={16} />
      default:
        return <FileText size={16} />
    }
  }

  // Function to get the appropriate badge color for activity type
  const getActivityTypeBadgeColor = (activityType: string) => {
    return 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="nice-shadow flex cursor-pointer items-center justify-center rounded-full bg-white p-2.5"
        aria-label={t('viewAllActivities')}
        title={t('viewAllActivities')}
      >
        <ListTree size={18} className="text-gray-700" />
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 mt-2 ${isMobile ? 'left-0 w-[90vw] sm:w-80' : 'left-0 w-80'} animate-in fade-in max-h-[70vh] cursor-pointer overflow-y-auto rounded-lg border border-gray-200 bg-white py-2 shadow-xl duration-200`}
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
            <h3 className="font-bold text-gray-800">{t('courseContent')}</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="cursor-pointer rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              <X size={18} />
            </button>
          </div>

          <div className="py-1">
            {props.course.chapters.map((chapter: any) => (
              <div key={chapter.id} className="mb-2">
                <div className="flex items-center border-y border-gray-100 bg-gray-50 px-4 py-2 font-medium text-gray-600">
                  <div className="flex items-center space-x-2">
                    <Folder size={16} className="text-gray-400" />
                    <span>{chapter.name}</span>
                  </div>
                </div>
                <div className="py-1">
                  {chapter.activities.map((activity: any) => {
                    // Remove any prefixes from UUIDs
                    const cleanActivityUuid = activity.activity_uuid?.replace(
                      'activity_',
                      ''
                    )
                    const cleanCourseUuid = props.course.course_uuid?.replace(
                      'course_',
                      ''
                    )

                    return (
                      <Link
                        key={activity.id}
                        href={
                          getUriWithOrg(props.orgslug, '') +
                          `/course/${cleanCourseUuid}/activity/${cleanActivityUuid}`
                        }
                        prefetch={false}
                        onClick={() => setIsOpen(false)}
                      >
                        <div
                          className={`flex items-center px-4 py-2.5 transition-colors hover:bg-gray-100 ${
                            cleanActivityUuid ===
                            props.currentActivityId.replace('activity_', '')
                              ? 'border-l-2 border-gray-300 bg-gray-50 pl-3 font-medium'
                              : ''
                          }`}
                        >
                          <div className="flex flex-1 items-center gap-2">
                            <span className="text-gray-400">
                              {getActivityTypeIcon(activity.activity_type)}
                            </span>
                            <div className="text-sm">{activity.name}</div>
                          </div>
                          {props.course.trail?.runs
                            ?.find(
                              (run: any) => run.course_id === props.course.id
                            )
                            ?.steps?.find(
                              (step: any) =>
                                (step.activity_id === activity.id ||
                                  step.activity_id ===
                                    activity.activity_uuid) &&
                                step.complete === true
                            ) && (
                            <span className="ml-2 shrink-0 text-gray-400">
                              <Check size={14} />
                            </span>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface ActivityNavigationProps {
  course: any
  currentActivityId: string
  orgslug: string
  t: ReturnType<typeof useTranslations<'ActivityPage'>>
}

function ActivityNavigation(props: ActivityNavigationProps): React.ReactNode {
  const router = useRouter()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [isBottomNavVisible, setIsBottomNavVisible] = React.useState(true)
  const bottomNavRef = React.useRef<HTMLDivElement>(null)
  const [navWidth, setNavWidth] = React.useState<number | null>(null)
  const t = props.t

  // Function to find the current activity's position in the course
  const findActivityPosition = () => {
    let allActivities: any[] = []
    let currentIndex = -1

    // Flatten all activities from all chapters
    props.course.chapters.forEach((chapter: any) => {
      chapter.activities.forEach((activity: any) => {
        const cleanActivityUuid = activity.activity_uuid?.replace(
          'activity_',
          ''
        )
        allActivities.push({
          ...activity,
          cleanUuid: cleanActivityUuid,
          chapterName: chapter.name,
        })

        // Check if this is the current activity
        if (
          cleanActivityUuid === props.currentActivityId.replace('activity_', '')
        ) {
          currentIndex = allActivities.length - 1
        }
      })
    })

    return { allActivities, currentIndex }
  }

  const { allActivities, currentIndex } = findActivityPosition()

  // Get previous and next activities
  const prevActivity = currentIndex > 0 ? allActivities[currentIndex - 1] : null
  const nextActivity =
    currentIndex < allActivities.length - 1
      ? allActivities[currentIndex + 1]
      : null

  // Navigate to an activity
  const navigateToActivity = (activity: any) => {
    if (!activity) return

    const cleanCourseUuid = props.course.course_uuid?.replace('course_', '')
    router.push(
      getUriWithOrg(props.orgslug, '') +
        `/course/${cleanCourseUuid}/activity/${activity.cleanUuid}`
    )
  }

  // Set up intersection observer to detect when bottom nav is out of viewport
  // and measure the width of the bottom navigation
  React.useEffect(() => {
    if (!bottomNavRef.current) return

    // Update width when component mounts and on window resize
    const updateWidth = () => {
      if (bottomNavRef.current) {
        setNavWidth(bottomNavRef.current.offsetWidth)
      }
    }

    // Initial width measurement
    updateWidth()

    // Set up resize listener
    window.addEventListener('resize', updateWidth)

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsBottomNavVisible(entry.isIntersecting)
      },
      { threshold: 0.1 }
    )

    observer.observe(bottomNavRef.current)

    return () => {
      window.removeEventListener('resize', updateWidth)
      if (bottomNavRef.current) {
        observer.unobserve(bottomNavRef.current)
      }
    }
  }, [])

  // Navigation buttons component - reused for both top and bottom
  const NavigationButtons = ({ isFloating = false }) => (
    <div
      className={`${isFloating ? 'flex justify-between' : 'grid grid-cols-3'} w-full items-center`}
    >
      {isFloating ? (
        // Floating navigation - original flex layout
        <>
          <button
            onClick={() => navigateToActivity(prevActivity)}
            className={`flex cursor-pointer items-center space-x-1.5 rounded-md p-2 transition-all duration-200 ${
              prevActivity
                ? 'text-gray-700'
                : 'cursor-not-allowed text-gray-400 opacity-50'
            }`}
            disabled={!prevActivity}
            title={
              prevActivity
                ? t('prevActivityTitle', { name: prevActivity.name })
                : t('noPrevActivity')
            }
          >
            <ChevronLeft size={20} className="shrink-0 text-gray-800" />
            <div className="flex flex-col items-start">
              <span className="text-xs text-gray-500">{t('previous')}</span>
              <span className="text-left text-sm font-semibold capitalize">
                {prevActivity ? prevActivity.name : t('noPrevActivity')}
              </span>
            </div>
          </button>
          <button
            onClick={() => navigateToActivity(nextActivity)}
            className={`flex cursor-pointer items-center space-x-1.5 rounded-md p-2 transition-all duration-200 ${
              nextActivity
                ? 'text-gray-700'
                : 'cursor-not-allowed text-gray-400 opacity-50'
            }`}
            disabled={!nextActivity}
            title={
              nextActivity
                ? t('nextActivityTitle', { name: nextActivity.name })
                : t('noNextActivity')
            }
          >
            <div className="flex flex-col items-end">
              <span className="text-xs text-gray-500">{t('next')}</span>
              <span className="text-right text-sm font-semibold capitalize">
                {nextActivity ? nextActivity.name : t('noNextActivity')}
              </span>
            </div>
            <ChevronRight size={20} className="shrink-0 text-gray-800" />
          </button>
        </>
      ) : (
        // Regular navigation - grid layout with centered counter
        <>
          <div className="justify-self-start">
            <button
              onClick={() => navigateToActivity(prevActivity)}
              className={`flex cursor-pointer items-center space-x-1.5 rounded-md px-3.5 py-2 transition-all duration-200 ${
                prevActivity
                  ? 'nice-shadow bg-white text-gray-700'
                  : 'cursor-not-allowed bg-gray-100 text-gray-400'
              }`}
              disabled={!prevActivity}
              title={
                prevActivity
                  ? t('prevActivityTitle', { name: prevActivity.name })
                  : t('noPrevActivity')
              }
            >
              <ChevronLeft size={16} className="shrink-0" />
              <div className="flex flex-col items-start">
                <span className="text-xs text-gray-500">{t('previous')}</span>
                <span className="text-left text-sm font-semibold capitalize">
                  {prevActivity ? prevActivity.name : t('noPrevActivity')}
                </span>
              </div>
            </button>
          </div>
          <div className="justify-self-center text-sm text-gray-500">
            {t('activityCounter', {
              current: currentIndex + 1,
              total: allActivities.length,
            })}
          </div>
          <div className="justify-self-end">
            <button
              onClick={() => navigateToActivity(nextActivity)}
              className={`flex cursor-pointer items-center space-x-1.5 rounded-md px-3.5 py-2 transition-all duration-200 ${
                nextActivity
                  ? 'nice-shadow bg-white text-gray-700'
                  : 'cursor-not-allowed bg-gray-100 text-gray-400'
              }`}
              disabled={!nextActivity}
              title={
                nextActivity
                  ? t('nextActivityTitle', { name: nextActivity.name })
                  : t('noNextActivity')
              }
            >
              <div className="flex flex-col items-end">
                <span className="text-xs text-gray-500">{t('next')}</span>
                <span className="text-right text-sm font-semibold capitalize">
                  {nextActivity ? nextActivity.name : t('noNextActivity')}
                </span>
              </div>
              <ChevronRight size={16} className="shrink-0" />
            </button>
          </div>
        </>
      )}
    </div>
  )

  return (
    <>
      {/* Bottom navigation (in-place) */}
      <div ref={bottomNavRef} className="mt-6 mb-2 w-full">
        <NavigationButtons isFloating={false} />
      </div>

      {/* Floating bottom navigation - shown when bottom nav is not visible */}
      {!isBottomNavVisible && (
        <div className="fixed bottom-8 left-1/2 z-50 w-[85%] max-w-lg -translate-x-1/2 transform transition-all duration-300 ease-in-out sm:w-auto sm:min-w-[350px]">
          <div className="animate-in fade-in slide-in-from-bottom rounded-full bg-white/90 px-2.5 py-1.5 shadow-xs backdrop-blur-xl duration-300">
            <NavigationButtons isFloating={true} />
          </div>
        </div>
      )}
    </>
  )
}

export default ActivityClient
