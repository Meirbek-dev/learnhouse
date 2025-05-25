'use client'
import FormLayout, {
  FormField,
  FormLabelAndMessage,
  Input,
  Textarea,
} from '@components/Objects/StyledElements/Form/Form'
import { useFormik } from 'formik'
import { AlertTriangle } from 'lucide-react'
import * as Form from '@radix-ui/react-form'
import { useEffect, useState, useCallback } from 'react'
import ThumbnailUpdate from './ThumbnailUpdate'
import {
  useCourse,
  useCourseDispatch,
} from '@components/Contexts/CourseContext'
import FormTagInput from '@components/Objects/StyledElements/Form/TagInput'
import LearningItemsList from './LearningItemsList'
import { useTranslations } from 'next-intl'

type EditCourseStructureProps = {
  orgslug: string
  course_uuid?: string
}

interface MyCourseFormValues {
  name: string
  description: string
  about: string
  learnings: string
  tags: string
  public: boolean
}

const validate = (
  values: MyCourseFormValues,
  t: (key: string, values?: any) => string
) => {
  const errors: Partial<Record<keyof MyCourseFormValues, string>> = {}

  if (!values.name) {
    errors.name = t('errors.required', { fieldName: t('name.label') })
  } else if (values.name.length > 100) {
    errors.name = t('errors.maxLength', { count: 100 })
  }

  if (!values.description) {
    errors.description = t('errors.required', {
      fieldName: t('description.label'),
    })
  } else if (values.description.length > 1000) {
    errors.description = t('errors.maxLength', { count: 1000 })
  }

  if (!values.learnings) {
    errors.learnings = t('errors.required', { fieldName: t('learnings.label') })
  } else {
    try {
      const learningItems = JSON.parse(values.learnings)
      if (!Array.isArray(learningItems)) {
        errors.learnings = t('errors.invalidFormat')
      } else if (learningItems.length === 0) {
        errors.learnings = t('errors.atLeastOneLearningItem')
      } else {
        const hasEmptyText = learningItems.some(
          (item: any) => !item.text || item.text.trim() === ''
        )
        if (hasEmptyText) {
          errors.learnings = t('errors.allLearningItemsMustHaveText')
        }
      }
    } catch {
      errors.learnings = t('errors.invalidJsonFormat')
    }
  }

  return errors
}

const initializeLearnings = (learningsInput: any): string => {
  if (typeof learningsInput === 'string') {
    try {
      const parsed = JSON.parse(learningsInput)
      if (Array.isArray(parsed)) {
        return learningsInput
      }
    } catch {
      if (learningsInput.trim() !== '') {
        return JSON.stringify([
          { id: Date.now().toString(), text: learningsInput, emoji: '📝' },
        ])
      }
    }
  }
  return JSON.stringify([{ id: Date.now().toString(), text: '', emoji: '📝' }])
}

function EditCourseGeneral(props: EditCourseStructureProps) {
  const [error, setError] = useState('')
  const course = useCourse()
  const dispatchCourse = useCourseDispatch()
  if (!course || !dispatchCourse) throw new Error('Course context not found')
  const { isLoading, courseStructure } = course
  const t = useTranslations('CourseEdit.General')

  const formik = useFormik<MyCourseFormValues>({
    initialValues: {
      name: courseStructure?.name || '',
      description: courseStructure?.description || '',
      about: courseStructure?.about || '',
      learnings: initializeLearnings(courseStructure?.learnings),
      tags: courseStructure?.tags || '',
      public: courseStructure?.public || false,
    },
    validate: (values) => validate(values, t),
    onSubmit: async () => {
      try {
        dispatchCourse({ type: 'setIsSaved' })
      } catch {
        setError(t('errors.saveFailed'))
      }
    },
    enableReinitialize: true,
  })

  const handleLearningsChange = useCallback(
    (newLearningsValue: string) => {
      formik.setFieldValue('learnings', newLearningsValue)
    },
    [formik]
  )

  useEffect(() => {
    if (!isLoading && courseStructure) {
      const { values, initialValues } = formik
      const learningsChanged = values.learnings !== initialValues.learnings
      const otherChanged = (
        Object.keys(values) as Array<keyof MyCourseFormValues>
      )
        .filter((k) => k !== 'learnings' && k !== 'public')
        .some((key) => values[key] !== initialValues[key])

      if (learningsChanged || otherChanged) {
        dispatchCourse({ type: 'setIsNotSaved' })
        dispatchCourse({
          type: 'setCourseStructure',
          payload: {
            ...courseStructure,
            ...values,
          },
        })
      }
    }
  }, [
    formik.values,
    formik.initialValues,
    isLoading,
    courseStructure,
    dispatchCourse,
  ])

  return (
    <div>
      <div className="h-6" />
      <div className="mx-auto mr-10 ml-10 rounded-xl bg-white px-6 py-5 shadow-xs">
        {courseStructure && (
          <div className="editcourse-form">
            {error && (
              <div className="flex items-center justify-center space-x-2 rounded-md bg-red-200 p-4 text-red-950 shadow-xs transition-all">
                <AlertTriangle size={18} />
                <div className="text-sm font-bold">{error}</div>
              </div>
            )}
            <FormLayout onSubmit={formik.handleSubmit}>
              <FormField name="name">
                <FormLabelAndMessage
                  label={t('name.label')}
                  message={formik.touched.name ? formik.errors.name : undefined}
                />
                <Form.Control asChild>
                  <Input
                    style={{ backgroundColor: 'white' }}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.name}
                    name="name"
                    type="text"
                    required
                  />
                </Form.Control>
              </FormField>

              <FormField name="description">
                <FormLabelAndMessage
                  label={t('description.label')}
                  message={
                    formik.touched.description
                      ? formik.errors.description
                      : undefined
                  }
                />
                <Form.Control asChild>
                  <Input
                    style={{ backgroundColor: 'white' }}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.description}
                    name="description"
                    type="text"
                    required
                  />
                </Form.Control>
              </FormField>

              <FormField name="about">
                <FormLabelAndMessage
                  label={t('about.label')}
                  message={
                    formik.touched.about ? formik.errors.about : undefined
                  }
                />
                <Form.Control asChild>
                  <Textarea
                    style={{ backgroundColor: 'white' }}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.about}
                    name="about"
                  />
                </Form.Control>
              </FormField>

              <FormField name="learnings">
                <FormLabelAndMessage
                  label={t('learnings.label')}
                  message={
                    formik.touched.learnings
                      ? formik.errors.learnings
                      : undefined
                  }
                />
                <LearningItemsList
                  value={formik.values.learnings}
                  onChange={handleLearningsChange}
                  error={formik.errors.learnings}
                />
              </FormField>

              <FormField name="tags">
                <FormLabelAndMessage
                  label={t('tags.label')}
                  message={formik.touched.tags ? formik.errors.tags : undefined}
                />
                <FormTagInput
                  placeholder={t('tags.placeholder')}
                  onChange={(value) => formik.setFieldValue('tags', value)}
                  value={formik.values.tags}
                />
              </FormField>

              <FormField name="thumbnail">
                <FormLabelAndMessage label={t('thumbnail.label')} />
                <ThumbnailUpdate />
              </FormField>
            </FormLayout>
          </div>
        )}
      </div>
    </div>
  )
}

export default EditCourseGeneral
