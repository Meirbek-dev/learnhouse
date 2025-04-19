'use client'
import { useCourse } from '@components/Contexts/CourseContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getAPIUrl } from '@services/config/config'
import { updateCourseThumbnail } from '@services/courses/courses'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import {
  ArrowBigUpDash,
  UploadCloud,
  Image as ImageIcon,
  FileWarning,
} from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useState } from 'react'
import * as React from 'react'
import { mutate } from 'swr'
import UnsplashImagePicker from './UnsplashImagePicker'
import { useTranslations } from 'next-intl'
import toast from 'react-hot-toast'

function ThumbnailUpdate() {
  const course = useCourse() as any
  const session = useLHSession() as any
  const org = useOrg() as any
  const [localThumbnail, setLocalThumbnail] = React.useState(null) as any
  const [isLoading, setIsLoading] = React.useState(false) as any
  const [error, setError] = React.useState('') as any
  const [showUnsplashPicker, setShowUnsplashPicker] = useState(false)
  const t = useTranslations('CourseEdit.General.Thumbnail')
  const tNotify = useTranslations('Notifications')

  const handleFileChange = async (event: any) => {
    const file = event.target.files[0]
    setLocalThumbnail(file)
    await updateThumbnail(file)
  }

  const handleUnsplashSelect = async (imageUrl: string) => {
    setIsLoading(true)
    const response = await fetch(imageUrl)
    const blob = await response.blob()
    const file = new File([blob], 'unsplash_image.jpg', { type: 'image/jpeg' })
    setLocalThumbnail(file)
    await updateThumbnail(file)
  }

  const updateThumbnail = async (file: File) => {
    setIsLoading(true)
    const toast_loading = tNotify('uploading')
    const toast_id = toast.loading(toast_loading)

    try {
      const res = await updateCourseThumbnail(
        course.courseStructure.course_uuid,
        file,
        session.data?.tokens?.access_token
      )
      mutate(`${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta`)

      if (res.success === false) {
        setError(res.HTTPmessage || tNotify('avatarError'))
        toast.error(res.HTTPmessage || tNotify('avatarError'), { id: toast_id })
      } else {
        setError('')
        toast.success(tNotify('avatarSuccess'), { id: toast_id })
      }
    } catch (err) {
      console.error('Error updating thumbnail:', err)
      setError(tNotify('avatarError'))
      toast.error(tNotify('avatarError'), { id: toast_id })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-[200px] w-auto rounded-xl bg-gray-50 shadow-sm outline-gray-200">
      <div className="flex h-full flex-col items-center justify-center">
        <div className="flex flex-col items-center justify-center">
          <div className="flex flex-col items-center justify-center">
            {error && (
              <div className="flex items-center justify-center space-x-2 rounded-md bg-red-200 p-2 text-red-950 shadow-xs transition-all">
                <FileWarning size={16} className="mr-2" />
                <div className="text-sm font-semibold first-letter:uppercase">
                  {error}
                </div>
              </div>
            )}
            {localThumbnail ? (
              <img
                src={URL.createObjectURL(localThumbnail)}
                className={`${isLoading ? 'animate-pulse' : ''} h-[100px] w-[200px] rounded-md shadow-sm`}
                alt="Course Thumbnail Preview"
              />
            ) : (
              <img
                src={`${
                  course.courseStructure.thumbnail_image
                    ? getCourseThumbnailMediaDirectory(
                        org?.org_uuid,
                        course.courseStructure.course_uuid,
                        course.courseStructure.thumbnail_image
                      )
                    : '/empty_thumbnail.png'
                }`}
                className="h-[100px] w-[200px] rounded-md bg-gray-200 shadow-sm"
                alt="Course Thumbnail"
              />
            )}
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="text-gray mt-4 flex animate-pulse items-center rounded-md bg-green-200 px-4 py-2 text-sm font-bold antialiased">
                <ArrowBigUpDash size={16} className="mr-2" />
                <span>{t('uploading')}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-2">
              <input
                type="file"
                id="fileInput"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                accept="image/*"
              />
              <button
                type="button"
                className="text-gray mt-6 flex items-center rounded-md px-4 text-sm font-bold antialiased"
                onClick={() => document.getElementById('fileInput')?.click()}
              >
                <UploadCloud size={16} className="mr-2" />
                <span>{t('uploadImageButton')}</span>
              </button>
              <button
                type="button"
                className="text-gray mt-6 flex items-center rounded-md px-4 text-sm font-bold antialiased"
                onClick={() => setShowUnsplashPicker(true)}
              >
                <ImageIcon size={16} className="mr-2" />
                <span>{t('chooseFromGalleryButton')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
      {showUnsplashPicker && (
        <UnsplashImagePicker
          onSelect={handleUnsplashSelect}
          onClose={() => setShowUnsplashPicker(false)}
          isOpen={showUnsplashPicker}
        />
      )}
    </div>
  )
}

export default ThumbnailUpdate
