'use client'
import { getAPIUrl } from '@services/config/config'
import { updateCourseOrderStructure } from '@services/courses/chapters'
import { revalidateTags } from '@services/utils/ts/requests'
import {
  useCourse,
  useCourseDispatch,
} from '@components/Contexts/CourseContext'
import { Check, SaveAllIcon, Timer, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { mutate } from 'swr'
import { updateCourse } from '@services/courses/courses'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useTranslations } from 'next-intl'

function SaveState(props: { orgslug: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const course = useCourse() as any
  const session = useLHSession() as any
  const router = useRouter()
  const saved = course ? course.isSaved : true
  const dispatchCourse = useCourseDispatch() as any
  const course_structure = course.courseStructure
  const t = useTranslations('Common')

  const withUnpublishedActivities = course
    ? course.withUnpublishedActivities
    : false
  const saveCourseState = async () => {
    if (saved || isLoading) return
    setIsLoading(true)
    try {
      // Course  order
      await changeOrderBackend()
      mutate(
        `${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`
      )
      // Course metadata
      await changeMetadataBackend()
      mutate(
        `${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`
      )
      await revalidateTags(['courses'], props.orgslug)
      dispatchCourse({ type: 'setIsSaved' })
    } finally {
      setIsLoading(false)
    }
  }

  // Course Order
  const changeOrderBackend = async () => {
    mutate(
      `${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`
    )
    await updateCourseOrderStructure(
      course.courseStructure.course_uuid,
      course.courseOrder,
      session.data?.tokens?.access_token
    )
    await revalidateTags(['courses'], props.orgslug)
    router.refresh()
    dispatchCourse({ type: 'setIsSaved' })
  }

  // Course metadata
  const changeMetadataBackend = async () => {
    mutate(
      `${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`
    )
    await updateCourse(
      course.courseStructure.course_uuid,
      course.courseStructure,
      session.data?.tokens?.access_token
    )
    await revalidateTags(['courses'], props.orgslug)
    router.refresh()
    dispatchCourse({ type: 'setIsSaved' })
  }

  const handleCourseOrder = (course_structure: any) => {
    const chapters = course_structure.chapters
    const chapter_order_by_ids = chapters.map((chapter: any) => {
      return {
        chapter_id: chapter.id,
        activities_order_by_ids: chapter.activities.map((activity: any) => {
          return {
            activity_id: activity.id,
          }
        }),
      }
    })
    dispatchCourse({
      type: 'setCourseOrder',
      payload: { chapter_order_by_ids: chapter_order_by_ids },
    })
    dispatchCourse({ type: 'setIsNotSaved' })
  }

  const initOrderPayload = () => {
    if (course_structure && course_structure.chapters) {
      handleCourseOrder(course_structure)
      dispatchCourse({ type: 'setIsSaved' })
    }
  }

  const changeOrderPayload = () => {
    if (course_structure && course_structure.chapters) {
      handleCourseOrder(course_structure)
      dispatchCourse({ type: 'setIsNotSaved' })
    }
  }

  useEffect(() => {
    if (course_structure?.chapters) {
      initOrderPayload()
    }
    if (course_structure?.chapters && !saved) {
      changeOrderPayload()
    }
  }, [course_structure])

  return (
    <div className="flex space-x-4">
      {saved ? (
        <></>
      ) : (
        <div className="flex items-center space-x-2 text-gray-600 antialiased">
          <Timer size={15} />
          <div>{t('unsavedChanges')}</div>
        </div>
      )}
      <div
        className={
          `flex cursor-pointer items-center space-x-2 rounded-lg px-4 py-2 font-bold antialiased drop-shadow-md transition-all ease-linear ` +
          (saved
            ? 'bg-gray-600 text-white'
            : 'border bg-black text-white hover:bg-gray-900') +
          (isLoading ? 'cursor-not-allowed opacity-50' : '')
        }
        onClick={saveCourseState}
      >
        {isLoading ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            <div>{t('saving')}</div>
          </>
        ) : saved ? (
          <>
            <Check size={20} />
            <div>{t('saved')}</div>
          </>
        ) : (
          <>
            <SaveAllIcon size={20} />
            <div>{t('save')}</div>
          </>
        )}
      </div>
    </div>
  )
}

export default SaveState
