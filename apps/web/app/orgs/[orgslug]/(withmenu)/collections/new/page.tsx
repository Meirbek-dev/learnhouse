'use client'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { createCollection } from '@services/courses/collections'
import useSWR from 'swr'
import { getAPIUrl, getUriWithOrg } from '@services/config/config'
import { revalidateTags, swrFetcher } from '@services/utils/ts/requests'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { Loader2, Image as ImageIcon } from 'lucide-react'
import { toast } from 'react-hot-toast'
import Image from 'next/image'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import { useTranslations } from 'next-intl'

function NewCollection(params: any) {
  const t = useTranslations('NewCollectionPage')
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const orgslug = params.params.orgslug
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [selectedCourses, setSelectedCourses] = React.useState([]) as any
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const {
    data: courses,
    error: error,
    isLoading,
  } = useSWR(
    `${getAPIUrl()}courses/org_slug/${orgslug}/page/1/limit/10`,
    (url) => swrFetcher(url, access_token)
  )
  const [isPublic, setIsPublic] = useState('true')

  const handleVisibilityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setIsPublic(e.target.value)
  }

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value)
  }

  const handleDescriptionChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setDescription(event.target.value)
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error(t('toast.missingName'))
      return
    }

    if (!description.trim()) {
      toast.error(t('toast.missingDescription'))
      return
    }

    if (selectedCourses.length === 0) {
      toast.error(t('toast.noCoursesSelected'))
      return
    }

    setIsSubmitting(true)
    try {
      const collection = {
        name: name.trim(),
        description: description.trim(),
        courses: selectedCourses,
        public: isPublic,
        org_id: org.id,
      }
      await createCollection(collection, session.data?.tokens?.access_token)
      await revalidateTags(['collections'], org.slug)
      toast.success(t('toast.success'))
      router.push(getUriWithOrg(orgslug, '/collections'))
    } catch (error) {
      toast.error(t('toast.failure'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-red-500">
          {t('errorLoadingCourses')}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('title')}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {t('description')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                {t('nameLabel')}
              </span>
              <input
                type="text"
                placeholder={t('namePlaceholder')}
                value={name}
                onChange={handleNameChange}
                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                maxLength={100}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                {t('visibilityLabel')}
              </span>
              <select
                onChange={handleVisibilityChange}
                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                defaultValue={isPublic}
              >
                <option value="true">
                  {t('visibilityPublic')}
                </option>
                <option value="false">
                  {t('visibilityPrivate')}
                </option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                {t('descriptionLabel')}
              </span>
              <textarea
                placeholder={t('descriptionPlaceholder')}
                value={description}
                onChange={handleDescriptionChange}
                rows={4}
                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                maxLength={500}
              />
            </label>

            <div className="space-y-2">
              <span className="text-sm font-medium text-gray-700">
                {t('selectCoursesLabel')}
              </span>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                </div>
              ) : courses?.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">
                  {t('noCoursesAvailable')}
                </p>
              ) : (
                <div className="mt-2 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="max-h-[400px] overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">
                    {courses?.map((course: any) => (
                      <label
                        key={course.id}
                        className="relative flex items-center p-4 bg-white rounded-md hover:bg-gray-50 transition cursor-pointer gap-4"
                      >
                        <input
                          type="checkbox"
                          id={course.id}
                          name={course.name}
                          value={course.id}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCourses([
                                ...selectedCourses,
                                course.id,
                              ])
                            } else {
                              setSelectedCourses(
                                selectedCourses.filter(
                                  (id: any) => id !== course.id
                                )
                              )
                            }
                          }}
                          className="h-4 w-4 text-blue-500 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <div className="relative w-24 h-16 rounded-md overflow-hidden bg-gray-100 shrink-0">
                          {course.thumbnail_image ? (
                            <img
                              src={getCourseThumbnailMediaDirectory(
                                org.org_uuid,
                                course.course_uuid,
                                course.thumbnail_image
                              )}
                              alt={course.name}
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-gray-900 truncate">
                            {course.name}
                          </h3>
                          {course.description && (
                            <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                              {course.description}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      {t('selectedCount', { count: selectedCourses.length })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition"
            >
              {t('cancelButton')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-xs hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isSubmitting ? t('creatingButton') : t('createButton')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default NewCollection
