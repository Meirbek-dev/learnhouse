'use client'
import { useCourse } from '@components/Contexts/CourseContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getAPIUrl } from '@services/config/config'
import { updateCourseThumbnail } from '@services/courses/courses'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import { ArrowBigUpDash, UploadCloud, Image as ImageIcon } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import React, { useState, useEffect } from 'react'
import { mutate } from 'swr'
import UnsplashImagePicker from './UnsplashImagePicker'
import { useTranslations } from 'next-intl'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const VALID_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'] as const

type ValidMimeType = (typeof VALID_MIME_TYPES)[number]

function ThumbnailUpdate() {
  const course = useCourse() as any
  const session = useLHSession() as any
  const org = useOrg() as any
  const [localThumbnail, setLocalThumbnail] = useState<{
    file: File
    url: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [showUnsplashPicker, setShowUnsplashPicker] = useState(false)
  const t = useTranslations('CourseEdit.General.Thumbnail')
  const tNotify = useTranslations('Notifications')
  const withUnpublishedActivities = course
    ? course.withUnpublishedActivities
    : false

  // Cleanup blob URLs when component unmounts or when thumbnail changes
  useEffect(() => {
    return () => {
      if (localThumbnail?.url) {
        URL.revokeObjectURL(localThumbnail.url)
      }
    }
  }, [localThumbnail])

  const validateFile = (file: File): boolean => {
    if (!VALID_MIME_TYPES.includes(file.type as ValidMimeType)) {
      setError('Please upload only PNG or JPG/JPEG images')
      return false
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('File size should be less than 5MB')
      return false
    }

    return true
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!validateFile(file)) {
      event.target.value = ''
      return
    }

    const blobUrl = URL.createObjectURL(file)
    setLocalThumbnail({ file, url: blobUrl })
    await updateThumbnail(file)
  }

  const handleUnsplashSelect = async (imageUrl: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(imageUrl)
      const blob = await response.blob()

      if (!VALID_MIME_TYPES.includes(blob.type as ValidMimeType)) {
        throw new Error('Invalid image format from Unsplash')
      }

      const file = new File([blob], `unsplash_${Date.now()}.jpg`, {
        type: blob.type,
      })

      if (!validateFile(file)) {
        return
      }

      const blobUrl = URL.createObjectURL(file)
      setLocalThumbnail({ file, url: blobUrl })
      await updateThumbnail(file)
    } catch (err) {
      setError('Failed to process Unsplash image')
      setIsLoading(false)
    }
  }

  const updateThumbnail = async (file: File) => {
    setIsLoading(true)
    try {
      const res = await updateCourseThumbnail(
        course.courseStructure.course_uuid,
        file,
        session.data?.tokens?.access_token
      )

      await mutate(
        `${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`
      )
      await new Promise((r) => setTimeout(r, 1500))

      if (res.success === false) {
        setError(res.HTTPmessage)
      } else {
        setError('')
      }
    } catch (err) {
      setError('Failed to update thumbnail')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="light-shadow h-[250px] w-auto rounded-xl border border-gray-200 bg-gray-50 transition-all duration-200">
      <div className="flex h-full flex-col items-center justify-center space-y-4 p-6">
        {error && (
          <div className="absolute top-4 flex items-center justify-center space-x-2 rounded-lg bg-red-50 p-3 text-red-800 transition-all">
            <div className="text-sm font-medium">{error}</div>
          </div>
        )}

        <div className="flex flex-col items-center space-y-4">
          {localThumbnail ? (
            <img
              src={localThumbnail.url}
              className={`${
                isLoading ? 'animate-pulse' : ''
              } h-[140px] w-[280px] rounded-lg border border-gray-200 object-cover shadow-sm`}
              alt="Course thumbnail"
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
              className="h-[140px] w-[280px] rounded-lg border border-gray-200 bg-gray-50 object-cover shadow-sm"
              alt="Course thumbnail"
            />
          )}

          {!isLoading && (
            <div className="flex space-x-2">
              <input
                type="file"
                id="fileInput"
                className="hidden"
                accept=".jpg,.jpeg,.png"
                onChange={handleFileChange}
              />
              <button
                className="flex items-center rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-800 transition-colors duration-200 hover:bg-gray-100"
                onClick={() => document.getElementById('fileInput')?.click()}
              >
                <UploadCloud size={16} className="mr-2" />
                {t('uploadImageButton')}
              </button>
              <button
                className="flex items-center rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-800 transition-colors duration-200 hover:bg-gray-100"
                onClick={() => setShowUnsplashPicker(true)}
              >
                <ImageIcon size={16} className="mr-2" />
                Gallery
              </button>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center">
            <div className="flex items-center rounded-full bg-green-50 px-4 py-2 text-sm font-medium text-green-800">
              <ArrowBigUpDash size={16} className="mr-2 animate-bounce" />
              Uploading...
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500">
          Supported formats: PNG, JPG/JPEG
        </p>
      </div>

      {showUnsplashPicker && (
        <UnsplashImagePicker
          onSelect={handleUnsplashSelect}
          onClose={() => setShowUnsplashPicker(false)}
        />
      )}
    </div>
  )
}

export default ThumbnailUpdate
