'use client'
import { useOrg } from '@components/Contexts/OrgContext'
import { getAPIUrl, getUriWithOrg } from '@services/config/config'
import { removeCourse } from '@services/courses/activity'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import { revalidateTags } from '@services/utils/ts/requests'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import { mutate } from 'swr'
import { useTranslations } from 'next-intl'

interface TrailCourseElementProps {
  course: any
  run: any
  orgslug: string
}

function TrailCourseElement({ course, run, orgslug }: TrailCourseElementProps) {
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const courseid = course.course_uuid.replace('course_', '')
  const router = useRouter()
  const t = useTranslations('Trail')
  const orgID = org?.id
  const course_total_steps = run.course_total_steps
  const course_completed_steps = run.steps.length
  const course_progress = useMemo(
    () =>
      course_total_steps > 0
        ? Math.round((course_completed_steps / course_total_steps) * 100)
        : 0,
    [course_total_steps, course_completed_steps]
  )

  async function quitCourse(course_uuid: string) {
    await removeCourse(course_uuid, orgslug, access_token)
    await revalidateTags(['courses'], orgslug)
    router.refresh()
    mutate(`${getAPIUrl()}trail/org/${orgID}/trail`)
  }

  useEffect(() => {}, [course, org])

  return (
    <div
      className="trailcoursebox flex rounded-xl bg-white p-3"
      style={{ boxShadow: '0px 4px 7px 0px rgba(0, 0, 0, 0.03)' }}
    >
      <Link href={getUriWithOrg(orgslug, `/course/${courseid}`)}>
        <div
          className="course_tumbnail relative inset-0 h-[50px] w-[72px] rounded-lg bg-cover bg-center ring-1 ring-inset ring-black/10"
          style={{
            backgroundImage: `url(${getCourseThumbnailMediaDirectory(
              org.org_uuid,
              course.course_uuid,
              course.thumbnail_image
            )})`,
            boxShadow: '0px 4px 7px 0px rgba(0, 0, 0, 0.03)',
          }}
        />
      </Link>
      <div className="course_meta grow space-y-1 pl-5">
        <div className="course_top">
          <div className="course_info flex">
            <div className="course_basic flex-end flex flex-col -space-y-2">
              <p className="p-0 pb-1 text-sm font-bold text-gray-700">
                {t('courseLabel')}
              </p>
              <div className="course_progress flex items-center space-x-2">
                <h2 className="text-xl font-bold">{course.name}</h2>
                <div className="h-[5px] w-[10px] rounded-full bg-slate-300" />
                <h2>{course_progress}%</h2>
              </div>
            </div>
            <div className="course_actions flex grow flex-row-reverse">
              <button
                onClick={() => quitCourse(course.course_uuid)}
                className="h-5 rounded-full bg-red-200 px-2 text-xs font-bold text-red-700 hover:bg-red-300"
              >
                {t('quitCourseButton')}
              </button>
            </div>
          </div>
        </div>
        <div className="course_progress indicator w-full">
          <div className="h-1.5 w-full rounded-full bg-gray-200">
            <div
              className={'h-1.5 rounded-full bg-teal-600'}
              style={{ width: `${course_progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default TrailCourseElement
