'use client'
import { useOrg } from '@components/Contexts/OrgContext'
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import { getUriWithOrg } from '@services/config/config'
import { deleteCourseFromBackend } from '@services/courses/courses'
import {
  getCourseThumbnailMediaDirectory,
  getUserAvatarMediaDirectory,
} from '@services/media/media'
import { revalidateTags } from '@services/utils/ts/requests'
import { BookMinus, FilePenLine, Settings2, MoreVertical } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import UserAvatar from '@components/Objects/UserAvatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu'
import { useLocale, useTranslations } from 'next-intl'

type Course = {
  course_uuid: string
  name: string
  description: string
  thumbnail_image: string
  org_id: string
  update_date: string
  authors?: Array<{
    user: {
      id: string
      user_uuid: string
      avatar_image: string
      first_name: string
      last_name: string
      username: string
    }
    authorship: 'CREATOR' | 'CONTRIBUTOR' | 'MAINTAINER' | 'REPORTER'
    authorship_status: 'ACTIVE' | 'INACTIVE' | 'PENDING'
  }>
}

type PropsType = {
  course: Course
  orgslug: string
  customLink?: string
}

export const removeCoursePrefix = (course_uuid: string) =>
  course_uuid.replace('course_', '')

function CourseThumbnail({ course, orgslug, customLink }: PropsType) {
  const t = useTranslations('Components.CourseThumbnail')
  const locale = useLocale()
  const router = useRouter()
  const org = useOrg() as any
  const session = useLHSession() as any

  const activeAuthors =
    course.authors?.filter((author) => author.authorship_status === 'ACTIVE') ||
    []
  const displayedAuthors = activeAuthors.slice(0, 3)
  const hasMoreAuthors = activeAuthors.length > 3
  const remainingAuthorsCount = activeAuthors.length - 3

  const deleteCourse = async () => {
    const toastId = toast.loading(t('deleting'))
    try {
      await deleteCourseFromBackend(
        course.course_uuid,
        session.data?.tokens?.access_token
      )
      await revalidateTags(['courses'], orgslug)
      toast.success(t('toastDeleteSuccess'))
      router.refresh()
    } catch (_error) {
      toast.error(t('toastDeleteError'))
    } finally {
      toast.dismiss(toastId)
    }
  }

  const thumbnailImage = course.thumbnail_image
    ? getCourseThumbnailMediaDirectory(
        org?.org_uuid,
        course.course_uuid,
        course.thumbnail_image
      )
    : '../empty_thumbnail.png'

  return (
    <div className="nice-shadow relative flex w-full min-w-[280px] max-w-sm shrink-0 flex-col overflow-hidden rounded-xl bg-white">
      <AdminEditOptions
        course={course}
        orgSlug={orgslug}
        deleteCourse={deleteCourse}
      />
      <Link
        prefetch
        href={
          customLink
            ? customLink
            : getUriWithOrg(
                orgslug,
                `/course/${removeCoursePrefix(course.course_uuid)}`
              )
        }
      >
        <img
          className="inset-0 aspect-video w-full rounded-t-xl bg-cover bg-center ring-1 ring-inset ring-black/10"
          src={thumbnailImage}
          alt={course.name}
        />
      </Link>
      <div className="flex w-full flex-col space-y-3 p-4">
        <div className="space-y-2">
          <h2 className="line-clamp-2 min-h-[2.75rem] text-base font-bold leading-tight text-gray-800">
            {course.name}
          </h2>
          <p className="line-clamp-3 min-h-[2.75rem] text-xs leading-normal text-gray-700">
            {course.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {course.update_date && (
            <div className="inline-flex h-5 min-w-[140px] items-center justify-center rounded-md border border-gray-200 bg-gray-100/80 px-2">
              <span className="truncate text-[10px] font-medium text-gray-600">
                {t('updated')}{' '}
                {new Date(course.update_date).toLocaleDateString(locale, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}
          {displayedAuthors.length > 0 && (
            <div className="flex items-center -space-x-4">
              {displayedAuthors.map((author, index) => (
                <div
                  key={author.user.user_uuid}
                  className="relative"
                  style={{ zIndex: displayedAuthors.length - index }}
                >
                  <UserAvatar
                    border="border-2"
                    rounded="rounded-full"
                    avatar_url={
                      author.user.avatar_image
                        ? getUserAvatarMediaDirectory(
                            author.user.user_uuid,
                            author.user.avatar_image
                          )
                        : ''
                    }
                    predefined_avatar={
                      author.user.avatar_image ? undefined : 'empty'
                    }
                    width={32}
                    showProfilePopup={true}
                    userId={author.user.id}
                  />
                </div>
              ))}
              {hasMoreAuthors && (
                <div className="relative -ml-1" style={{ zIndex: 0 }}>
                  <div className="flex h-[32px] w-[32px] items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[11px] font-medium text-gray-600">
                    +{remainingAuthorsCount}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <Link
          prefetch
          href={
            customLink
              ? customLink
              : getUriWithOrg(
                  orgslug,
                  `/course/${removeCoursePrefix(course.course_uuid)}`
                )
          }
          className="inline-flex w-full items-center justify-center rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800"
        >
          {t('startLearning')}
        </Link>
      </div>
    </div>
  )
}

const AdminEditOptions = ({
  course,
  orgSlug,
  deleteCourse,
}: {
  course: Course
  orgSlug: string
  deleteCourse: () => Promise<void>
}) => {
  const t = useTranslations('Components.CourseThumbnail')
  return (
    <AuthenticatedClientElement
      action="update"
      ressourceType="courses"
      checkMethod="roles"
      orgId={course.org_id}
    >
      <div className="absolute right-2 top-2 z-20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full bg-white p-1 shadow-md transition-colors hover:bg-gray-100">
              <MoreVertical size={20} className="text-gray-700" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link
                prefetch
                href={getUriWithOrg(
                  orgSlug,
                  `/dash/courses/course/${removeCoursePrefix(course.course_uuid)}/content`
                )}
              >
                <FilePenLine className="mr-2 h-4 w-4" /> {t('editContent')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                prefetch
                href={getUriWithOrg(
                  orgSlug,
                  `/dash/courses/course/${removeCoursePrefix(course.course_uuid)}/general`
                )}
              >
                <Settings2 className="mr-2 h-4 w-4" /> {t('settings')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <ConfirmationModal
                confirmationButtonText={t('deleteButtonText')}
                confirmationMessage={t('deleteConfirmationMessage')}
                dialogTitle={t('deleteConfirmationTitle', {
                  courseName: course.name,
                })}
                dialogTrigger={
                  <button className="flex w-full items-center rounded-md bg-rose-500/10 px-2 py-1 text-left text-sm text-red-600 transition-colors hover:bg-rose-500/20">
                    <BookMinus className="mr-4 h-4 w-4" /> {t('delete')}
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
  )
}

export default CourseThumbnail
