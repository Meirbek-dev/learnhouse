import React from 'react'
import ReactConfetti from 'react-confetti'
import { Trophy, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { getUriWithOrg } from '@services/config/config'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import { useWindowSize } from 'usehooks-ts'
import { useOrg } from '@components/Contexts/OrgContext'
import { useTranslations } from 'next-intl'

interface CourseEndViewProps {
  courseName: string
  orgslug: string
  courseUuid: string
  thumbnailImage: string
}

const CourseEndView: React.FC<CourseEndViewProps> = ({
  courseName,
  orgslug,
  courseUuid,
  thumbnailImage,
}) => {
  const t = useTranslations('CourseEndView')
  const { width, height } = useWindowSize()
  const org = useOrg() as any

  return (
    <div className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-4 text-center">
      <div className="pointer-events-none fixed inset-0">
        <ReactConfetti
          width={width}
          height={height}
          numberOfPieces={200}
          recycle={false}
          colors={['#6366f1', '#10b981', '#3b82f6']}
        />
      </div>

      <div className="nice-shadow relative z-10 w-full max-w-2xl space-y-6 rounded-2xl bg-white p-8">
        <div className="flex flex-col items-center space-y-6">
          {thumbnailImage && (
            <img
              className="h-[114px] w-[200px] rounded-lg object-cover shadow-md"
              src={`${getCourseThumbnailMediaDirectory(
                org?.org_uuid,
                courseUuid,
                thumbnailImage
              )}`}
              alt={courseName}
            />
          )}

          <div className="rounded-full bg-emerald-100 p-4">
            <Trophy className="h-16 w-16 text-emerald-600" />
          </div>
        </div>

        <h1 className="text-4xl font-bold text-gray-900">
          {t('congratulations')}
        </h1>

        <p className="text-xl text-gray-600">
          {t('completedMessage')}
          <span className="font-semibold text-gray-900"> {courseName}</span>
        </p>

        <p className="text-gray-500">{t('dedicationMessage')}</p>

        <div className="pt-6">
          <Link
            href={
              getUriWithOrg(orgslug, '') +
              `/course/${courseUuid.replace('course_', '')}`
            }
            className="inline-flex items-center space-x-2 rounded-full bg-gray-800 px-6 py-3 text-white transition duration-200 hover:bg-gray-700"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>{t('backToCourse')}</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default CourseEndView
