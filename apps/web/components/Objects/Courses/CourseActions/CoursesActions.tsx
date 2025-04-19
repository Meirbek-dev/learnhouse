import { useState, useEffect } from 'react'
import { removeCourse, startCourse } from '@services/courses/activity'
import { revalidateTags } from '@services/utils/ts/requests'
import { useRouter } from 'next/navigation'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { getUriWithOrg, getUriWithoutOrg } from '@services/config/config'
import { getProductsByCourse } from '@services/payments/products'
import {
  ShoppingCart,
  AlertCircle,
  UserPen,
  ClockIcon,
  ArrowRight,
  BookOpen,
} from 'lucide-react'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import CoursePaidOptions from './CoursePaidOptions'
import { checkPaidAccess } from '@services/payments/payments'
import { applyForContributor } from '@services/courses/courses'
import toast from 'react-hot-toast'
import { useContributorStatus } from '../../../../hooks/useContributorStatus'
import CourseProgress from '../CourseProgress/CourseProgress'
import UserAvatar from '@components/Objects/UserAvatar'

interface CourseRun {
  status: string
  course_id: string
  steps: Array<{
    activity_id: string
    complete: boolean
  }>
}

interface Course {
  id: string
  trail?: {
    runs: CourseRun[]
  }
  chapters?: Array<{
    name: string
    activities: Array<{
      activity_uuid: string
      name: string
      activity_type: string
    }>
  }>
  open_to_contributors?: boolean
}

interface CourseActionsProps {
  courseuuid: string
  orgslug: string
  course: Course & {
    org_id: number
  }
}

function CoursesActions({ courseuuid, orgslug, course }: CourseActionsProps) {
  const router = useRouter()
  const session = useLHSession() as any
  const [linkedProducts, setLinkedProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [isContributeLoading, setIsContributeLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const { contributorStatus, refetch } = useContributorStatus(courseuuid)
  const [isProgressOpen, setIsProgressOpen] = useState(false)

  const isStarted =
    course.trail?.runs?.some(
      (run) =>
        run.status === 'STATUS_IN_PROGRESS' && run.course_id === course.id
    ) ?? false

  useEffect(() => {
    const fetchLinkedProducts = async () => {
      try {
        const response = await getProductsByCourse(
          course.org_id,
          course.id,
          session.data?.tokens?.access_token
        )
        setLinkedProducts(response.data || [])
      } catch (error) {
        console.error('Failed to fetch linked products')
      } finally {
        setIsLoading(false)
      }
    }

    fetchLinkedProducts()
  }, [course.id, course.org_id, session.data?.tokens?.access_token])

  useEffect(() => {
    const checkAccess = async () => {
      if (!session.data?.user) return
      try {
        const response = await checkPaidAccess(
          parseInt(course.id),
          course.org_id,
          session.data?.tokens?.access_token
        )
        setHasAccess(response.has_access)
      } catch (error) {
        console.error('Failed to check course access')
        toast.error('Failed to check course access. Please try again later.')
        setHasAccess(false)
      }
    }

    if (linkedProducts.length > 0) {
      checkAccess()
    }
  }, [
    course.id,
    course.org_id,
    session.data?.tokens?.access_token,
    linkedProducts,
  ])

  const handleCourseAction = async () => {
    if (!session.data?.user) {
      router.push(getUriWithoutOrg(`/signup?orgslug=${orgslug}`))
      return
    }

    setIsActionLoading(true)
    const loadingToast = toast.loading(
      isStarted ? 'Leaving course...' : 'Starting course...'
    )

    try {
      if (isStarted) {
        await removeCourse(
          'course_' + courseuuid,
          orgslug,
          session.data?.tokens?.access_token
        )
        await revalidateTags(['courses'], orgslug)
        toast.success('Successfully left the course', { id: loadingToast })
        router.refresh()
      } else {
        await startCourse(
          'course_' + courseuuid,
          orgslug,
          session.data?.tokens?.access_token
        )
        await revalidateTags(['courses'], orgslug)
        toast.success('Successfully started the course', { id: loadingToast })

        // Get the first activity from the first chapter
        const firstChapter = course.chapters?.[0]
        const firstActivity = firstChapter?.activities?.[0]

        if (firstActivity) {
          // Redirect to the first activity
          router.push(
            getUriWithOrg(orgslug, '') +
              `/course/${courseuuid}/activity/${firstActivity.activity_uuid.replace('activity_', '')}`
          )
        } else {
          router.refresh()
        }
      }
    } catch (error) {
      console.error('Failed to perform course action:', error)
      toast.error(
        isStarted
          ? 'Failed to leave the course. Please try again later.'
          : 'Failed to start the course. Please try again later.',
        { id: loadingToast }
      )
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleApplyToContribute = async () => {
    if (!session.data?.user) {
      router.push(getUriWithoutOrg(`/signup?orgslug=${orgslug}`))
      return
    }

    setIsContributeLoading(true)
    const loadingToast = toast.loading('Submitting contributor application...')

    try {
      const data = {
        message: 'I would like to contribute to this course.',
      }

      await applyForContributor(
        'course_' + courseuuid,
        data,
        session.data?.tokens?.access_token
      )
      await revalidateTags(['courses'], orgslug)
      await refetch()
      toast.success(
        'Your application to contribute has been submitted successfully',
        { id: loadingToast }
      )
    } catch (error) {
      console.error('Failed to apply as contributor:', error)
      toast.error(
        'Failed to submit your application. Please try again later.',
        { id: loadingToast }
      )
    } finally {
      setIsContributeLoading(false)
    }
  }

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
          <span>{action === 'start' ? 'Start Course' : 'Leave Course'}</span>
          <ArrowRight className="h-5 w-5" />
        </>
      )
    }

    return (
      <>
        <UserAvatar
          width={24}
          use_with_session={true}
          rounded="rounded-full"
          border="border-2"
          borderColor="border-white"
        />
        <span>{action === 'start' ? 'Start Course' : 'Leave Course'}</span>
        <ArrowRight className="h-5 w-5" />
      </>
    )
  }

  const renderContributorButton = () => {
    if (
      contributorStatus === 'INACTIVE' ||
      course.open_to_contributors !== true
    ) {
      return null
    }

    if (!session.data?.user) {
      return (
        <button
          onClick={() =>
            router.push(getUriWithoutOrg(`/signup?orgslug=${orgslug}`))
          }
          className="nice-shadow mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white py-3 font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          <UserPen className="h-5 w-5" />
          Authenticate to contribute
        </button>
      )
    }

    if (contributorStatus === 'ACTIVE') {
      return (
        <div className="nice-shadow mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 py-3 font-semibold text-green-700">
          <UserPen className="h-5 w-5" />
          You are a contributor
        </div>
      )
    }

    if (contributorStatus === 'PENDING') {
      return (
        <div className="nice-shadow mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 py-3 font-semibold text-amber-700">
          <ClockIcon className="h-5 w-5" />
          Contributor application pending
        </div>
      )
    }

    return (
      <button
        onClick={handleApplyToContribute}
        disabled={isContributeLoading}
        className="nice-shadow mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-white py-3 font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed"
      >
        {isContributeLoading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-700 border-t-transparent" />
        ) : (
          <>
            <UserPen className="h-5 w-5" />
            Apply to contribute
          </>
        )}
      </button>
    )
  }

  const renderProgressSection = () => {
    const totalActivities =
      course.chapters?.reduce(
        (acc: number, chapter: any) => acc + chapter.activities.length,
        0
      ) || 0
    const completedActivities =
      course.trail?.runs
        ?.find((run: CourseRun) => run.course_id === course.id)
        ?.steps?.filter((step) => step.complete)?.length || 0

    const progressPercentage = Math.round(
      (completedActivities / totalActivities) * 100
    )

    if (!isStarted) {
      return (
        <div className="nice-shadow relative overflow-hidden rounded-lg bg-white">
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                'radial-gradient(circle at center, #101010 1px, transparent 1px)',
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
                    <div className="text-sm font-medium text-gray-900">
                      Ready to Begin?
                    </div>
                    <div className="text-sm text-gray-500">
                      Start your learning journey with {totalActivities}{' '}
                      exciting{' '}
                      {totalActivities === 1 ? 'activity' : 'activities'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="nice-shadow relative overflow-hidden rounded-lg bg-white">
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'radial-gradient(circle at center, #000 1px, transparent 1px)',
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
                        2 *
                        Math.PI *
                        28 *
                        (1 - completedActivities / totalActivities)
                      }
                      className="transition-all duration-500 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-gray-800">
                      {progressPercentage}%
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsProgressOpen(true)}
                  className="flex-1 rounded-lg p-2 text-left transition-colors hover:bg-neutral-50/50"
                >
                  <div className="text-sm font-medium text-gray-900">
                    Course Progress
                  </div>
                  <div className="text-sm text-gray-500">
                    {completedActivities} of {totalActivities} completed
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="nice-shadow h-20 animate-pulse rounded-lg bg-gray-100" />
    )
  }

  if (linkedProducts.length > 0) {
    return (
      <div className="overflow-hidden rounded-lg bg-white p-4 shadow-md shadow-gray-300/25 outline-neutral-200/40">
        <div className="space-y-4">
          {hasAccess ? (
            <>
              <div className="nice-shadow rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                  <h3 className="font-semibold text-green-800">
                    You Own This Course
                  </h3>
                </div>
                <p className="mt-1 text-sm text-green-700">
                  You have purchased this course and have full access to all
                  content.
                </p>
              </div>
              <button
                onClick={handleCourseAction}
                disabled={isActionLoading}
                className={`nice-shadow flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg py-3 font-semibold transition-colors ${
                  isStarted
                    ? 'bg-red-500 text-white hover:bg-red-600 disabled:bg-red-400'
                    : 'bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-700'
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
              <div className="nice-shadow rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-800" />
                  <h3 className="font-semibold text-amber-800">Paid Course</h3>
                </div>
                <p className="mt-1 text-sm text-amber-700">
                  This course requires purchase to access its content.
                </p>
              </div>
              <Modal
                isDialogOpen={isModalOpen}
                onOpenChange={setIsModalOpen}
                dialogContent={<CoursePaidOptions course={course} />}
                dialogTitle="Purchase Course"
                dialogDescription="Select a payment option to access this course"
                minWidth="sm"
              />
              <button
                className="nice-shadow flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 py-3 font-semibold text-white transition-colors hover:bg-neutral-800"
                onClick={() => setIsModalOpen(true)}
              >
                <ShoppingCart className="h-5 w-5" />
                Purchase Course
              </button>
              {renderContributorButton()}
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white p-4 shadow-md shadow-gray-300/25 outline-neutral-200/40">
      <div className="space-y-4">
        {/* Progress Section */}
        {renderProgressSection()}

        {/* Start/Leave Course Button */}
        <button
          onClick={handleCourseAction}
          disabled={isActionLoading}
          className={`nice-shadow flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg py-3 font-semibold transition-colors ${
            isStarted
              ? 'bg-red-500 text-white hover:bg-red-600 disabled:bg-red-400'
              : 'bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-700'
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
        />
      </div>
    </div>
  )
}

export default CoursesActions
