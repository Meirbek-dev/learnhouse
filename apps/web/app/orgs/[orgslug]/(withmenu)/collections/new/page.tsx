'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import * as React from 'react'
import { createCollection } from '@services/courses/collections'
import useSWR from 'swr'
import { getAPIUrl, getUriWithOrg } from '@services/config/config'
import { revalidateTags, swrFetcher } from '@services/utils/ts/requests'
import { useOrg } from '@components/Contexts/OrgContext'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { Loader2, Image as ImageIcon } from 'lucide-react'
import { toast } from 'react-hot-toast'
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
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-red-500">{t('errorLoadingCourses')}</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="mt-2 text-sm text-gray-600">{t('description')}</p>
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
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 transition focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                maxLength={100}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                {t('visibilityLabel')}
              </span>
              <select
                onChange={handleVisibilityChange}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 transition focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                defaultValue={isPublic}
              >
                <option value="true">{t('visibilityPublic')}</option>
                <option value="false">{t('visibilityPrivate')}</option>
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
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 transition focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                maxLength={500}
              />
            </label>

            <div className="space-y-2">
              <span className="text-sm font-medium text-gray-700">
                {t('selectCoursesLabel')}
              </span>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                </div>
              ) : courses?.length === 0 ? (
                <p className="py-4 text-sm text-gray-500">
                  {t('noCoursesAvailable')}
                </p>
              ) : (
                <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50">
                  <div className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 max-h-[400px] space-y-3 overflow-y-auto p-4">
                    {courses?.map((course: any) => (
                      <label
                        key={course.id}
                        className="relative flex cursor-pointer items-center gap-4 rounded-md bg-white p-4 transition hover:bg-gray-50"
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
                          className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                        />
                        <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md bg-gray-100">
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
                            <div className="flex h-full w-full items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-medium text-gray-900">
                            {course.name}
                          </h3>
                          {course.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                              {course.description}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
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
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-hidden"
            >
              {t('cancelButton')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white shadow-xs transition hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>
                {isSubmitting ? t('creatingButton') : t('createButton')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default NewCollection
