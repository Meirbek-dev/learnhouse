'use client'

import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import useSWR from 'swr'
import { getOwnedCourses } from '@services/payments/payments'
import CourseThumbnail from '@components/Objects/Thumbnails/CourseThumbnail'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import { BookOpen, Package2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

function OwnedCoursesPage() {
  const t = useTranslations('DashPage.Courses')
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token

  const {
    data: ownedCourses,
    error,
    isLoading,
  } = useSWR(
    org ? [`/payments/${org.id}/courses/owned`, access_token] : null,
    ([url, token]) => getOwnedCourses(org.id, token)
  )

  if (isLoading) return <PageLoading />
  if (error) return <div>{t('error')}</div>

  return (
    <div className="h-full w-full bg-[#f8f8f8] pt-5 pr-10 pl-10">
      <div className="nice-shadow mb-6 flex flex-col rounded-md bg-white px-5 py-3">
        <div className="flex items-center gap-4">
          <Package2 className="h-8 w-8 text-gray-800" />
          <div className="flex flex-col -space-y-1">
            <h1 className="text-xl font-bold text-gray-800">
              {t('myCourses')}
            </h1>
            <h2 className="text-md text-gray-500">{t('purchasedCourses')}</h2>
          </div>
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {ownedCourses?.map((course: any) => (
          <div key={course.course_uuid} className="p-3">
            <CourseThumbnail course={course} orgslug={org.slug} />
          </div>
        ))}

        {(!ownedCourses || ownedCourses.length === 0) && (
          <div className="col-span-full flex items-center justify-center py-8">
            <div className="text-center">
              <div className="mb-4">
                <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
              </div>
              <h2 className="mb-2 text-xl font-bold text-gray-600">
                {t('noPurchasedCourses')}
              </h2>
              <p className="text-md text-gray-400">
                {t('noPurchasedCoursesDesc')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default OwnedCoursesPage
