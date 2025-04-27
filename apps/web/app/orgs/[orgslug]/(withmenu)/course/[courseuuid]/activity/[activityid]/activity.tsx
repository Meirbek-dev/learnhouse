'use client'
import Link from 'next/link'
import { getAPIUrl, getUriWithOrg } from '@services/config/config'
import Canva from '@components/Objects/Activities/DynamicCanva/DynamicCanva'
import VideoActivity from '@components/Objects/Activities/Video/Video'
import {
  BookOpenCheck,
  Check,
  CheckCircle,
  ChevronRight,
  MoreVertical,
  UserRoundPen,
  X,
  Edit2,
} from 'lucide-react'
import {
  markActivityAsComplete,
  unmarkActivityAsComplete,
} from '@services/courses/activity'
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
import React, { useEffect } from 'react'
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
import ToolTip from '@components/Objects/StyledElements/Tooltip/Tooltip'
import ActivityChapterDropdown from '@components/Pages/Activity/ActivityChapterDropdown'
import FixedActivitySecondaryBar from '@components/Pages/Activity/FixedActivitySecondaryBar'
import CourseEndView from '@components/Pages/Activity/CourseEndView'
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
            {activityid === 'end' ? (
              <CourseEndView
                courseName={course.name}
                orgslug={orgslug}
                courseUuid={course.course_uuid}
                thumbnailImage={course.thumbnail_image}
              />
            ) : (
              <div className="space-y-4 pt-0">
                <div className="pt-2">
                  <div className="activity-info-section space-y-4 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex space-x-6">
                        <div className="flex">
                          <Link
                            href={
                              getUriWithOrg(orgslug, '') +
                              `/course/${courseuuid}`
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
                            {t('course')}
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
                        />
                        <div className="flex flex-col -space-y-1">
                          <p className="text-md font-bold text-gray-700">
                            {t('courseLessons')}
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
                                    activity.activity_type ==
                                      'TYPE_DYNAMIC' && (
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
                                  <MoreVertical
                                    size={17}
                                    className="text-gray-300"
                                  />
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
                                  <MoreVertical
                                    size={17}
                                    className="text-gray-300"
                                  />
                                  <AssignmentSubmissionProvider
                                    assignment_uuid={
                                      assignment?.assignment_uuid
                                    }
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
                        <div
                          className={`rounded-lg p-7 drop-shadow-xs ${bgColor}`}
                        >
                          {/* Activity Types */}
                          <div>
                            {activity.activity_type == 'TYPE_DYNAMIC' && (
                              <Canva
                                content={activity.content}
                                activity={activity}
                              />
                            )}
                            {activity.activity_type == 'TYPE_VIDEO' && (
                              <VideoActivity
                                course={course}
                                activity={activity}
                              />
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
                                    assignment_uuid={
                                      assignment?.assignment_uuid
                                    }
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

                  {/* Fixed Activity Secondary Bar */}
                  {activity &&
                    activity.published == true &&
                    activity.content.paid_access != false && (
                      <FixedActivitySecondaryBar
                        course={course}
                        currentActivityId={activityid}
                        orgslug={orgslug}
                        activity={activity}
                      />
                    )}

                  <div style={{ height: '100px' }}></div>
                </div>
              </div>
            )}
          </GeneralWrapperStyled>
        </AIChatBotProvider>
      </CourseProvider>
    </>
  )
}

export function MarkStatus(props: {
  activity: any
  activityid: string
  course: any
  orgslug: string
  t: ReturnType<typeof useTranslations<'ActivityPage'>>
}) {
  const router = useRouter()
  const session = useLHSession() as any
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [isLoading, setIsLoading] = React.useState(false)
  const t = props.t

  const areAllActivitiesCompleted = () => {
    const run = props.course.trail.runs.find(
      (run: any) => run.course_id == props.course.id
    )
    if (!run) return false

    let totalActivities = 0
    let completedActivities = 0

    // Count all activities and completed activities
    props.course.chapters.forEach((chapter: any) => {
      chapter.activities.forEach((activity: any) => {
        totalActivities++
        const isCompleted = run.steps.find(
          (step: any) =>
            step.activity_id === activity.id && step.complete === true
        )
        if (isCompleted) {
          completedActivities++
        }
      })
    })

    console.log('Total activities:', totalActivities)
    console.log('Completed activities:', completedActivities)
    console.log('All completed?', completedActivities >= totalActivities - 1)

    // We check for totalActivities - 1 because the current activity completion
    // hasn't been counted yet (it's in progress)
    return completedActivities >= totalActivities - 1
  }

  async function markActivityAsCompleteFront() {
    try {
      // Check if this will be the last activity to complete
      const willCompleteAll = areAllActivitiesCompleted()
      console.log('Will complete all?', willCompleteAll)

      setIsLoading(true)
      await markActivityAsComplete(
        props.orgslug,
        props.course.course_uuid,
        props.activity.activity_uuid,
        session.data?.tokens?.access_token
      )

      // Mutate the course data
      await mutate(`${getAPIUrl()}courses/${props.course.course_uuid}/meta`)

      if (willCompleteAll) {
        console.log('Redirecting to end page...')
        const cleanCourseUuid = props.course.course_uuid.replace('course_', '')
        router.push(
          getUriWithOrg(props.orgslug, '') +
            `/course/${cleanCourseUuid}/activity/end`
        )
      } else {
        router.refresh()
      }
    } catch (error) {
      console.error('Error marking activity as complete:', error)
      toast.error(t('markCompleteError'))
    } finally {
      setIsLoading(false)
    }
  }

  async function unmarkActivityAsCompleteFront() {
    try {
      setIsLoading(true)
      const trail = await unmarkActivityAsComplete(
        props.orgslug,
        props.course.course_uuid,
        props.activity.activity_uuid,
        session.data?.tokens?.access_token
      )

      // Mutate the course data to trigger re-render
      await mutate(`${getAPIUrl()}courses/${props.course.course_uuid}/meta`)
      router.refresh()
    } catch (error) {
      toast.error(t('unmarkCompleteError'))
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
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 rounded-full bg-teal-600 p-2.5 px-5 text-white drop-shadow-md">
            <i>
              <Check size={17}></Check>
            </i>{' '}
            <i className="text-xs font-bold not-italic">
              {t('statusComplete')}
            </i>
          </div>
          <ToolTip content={t('unmarkAsComplete')} side="top">
            <ConfirmationModal
              confirmationButtonText={t('unmarkActivity')}
              confirmationMessage={t('unmarkConfirmation')}
              dialogTitle={t('unmarkDialogTitle')}
              dialogTrigger={
                <div
                  className={`${isLoading ? 'cursor-not-allowed opacity-75' : ''} flex items-center rounded-full bg-red-400 p-2 text-white drop-shadow-md transition delay-150 duration-300 ease-in-out hover:cursor-pointer`}
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
                    <X size={17} />
                  )}
                </div>
              }
              functionToExecute={unmarkActivityAsCompleteFront}
              status="warning"
            />
          </ToolTip>
          <NextActivityButton
            course={props.course}
            currentActivityId={props.activity.id}
            orgslug={props.orgslug}
          />
        </div>
      ) : (
        <div className="flex items-center space-x-2">
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
                {isLoading ? t('marking') : t('markAsComplete')}
              </i>
            )}
          </div>
          <NextActivityButton
            course={props.course}
            currentActivityId={props.activity.id}
            orgslug={props.orgslug}
          />
        </div>
      )}
    </>
  )
}

function NextActivityButton({
  course,
  currentActivityId,
  orgslug,
}: {
  course: any
  currentActivityId: string
  orgslug: string
}) {
  const router = useRouter()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const t = useTranslations('ActivityPage')

  const findNextActivity = () => {
    let allActivities: any[] = []
    let currentIndex = -1

    // Flatten all activities from all chapters
    course.chapters.forEach((chapter: any) => {
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
        if (activity.id === currentActivityId) {
          currentIndex = allActivities.length - 1
        }
      })
    })

    // Get next activity
    return currentIndex < allActivities.length - 1
      ? allActivities[currentIndex + 1]
      : null
  }

  const nextActivity = findNextActivity()

  if (!nextActivity) return null

  const navigateToActivity = () => {
    const cleanCourseUuid = course.course_uuid?.replace('course_', '')
    router.push(
      getUriWithOrg(orgslug, '') +
        `/course/${cleanCourseUuid}/activity/${nextActivity.cleanUuid}`
    )
  }

  return (
    <ToolTip
      content={t('nextActivityTitle', { name: nextActivity.name })}
      side="top"
    >
      <div
        onClick={navigateToActivity}
        className="nice-shadow flex items-center space-x-2 rounded-full bg-gray-300 p-2.5 px-5 text-gray-600 transition delay-150 duration-300 ease-in-out hover:cursor-pointer"
      >
        {!isMobile && <span className="text-xs font-bold">{t('next')}</span>}
        <ChevronRight size={17} />
      </div>
    </ToolTip>
  )
}

function AssignmentTools(props: {
  activity: any
  activityid: string
  course: any
  orgslug: string
  assignment: any
  t: ReturnType<typeof useTranslations<'ActivityPage'>>
}) {
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

  // Default return in case none of the conditions are met
  return null
}

export default ActivityClient
