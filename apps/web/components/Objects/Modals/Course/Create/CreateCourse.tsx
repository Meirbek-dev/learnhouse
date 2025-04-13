'use client'
import { Input } from "@components/ui/input"
import { Textarea } from "@components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import FormLayout, {
  FormField,
  FormLabelAndMessage,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { createNewCourse } from '@services/courses/courses'
import { getOrganizationContextInfoWithoutCredentials } from '@services/organizations/orgs'
import React, { useEffect } from 'react'
import { BarLoader } from 'react-spinners'
import { revalidateTags } from '@services/utils/ts/requests'
import { useRouter } from 'next/navigation'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import toast from 'react-hot-toast'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import {  UploadCloud, Image as ImageIcon } from 'lucide-react'
import UnsplashImagePicker from "@components/Dashboard/Pages/Course/EditCourseGeneral/UnsplashImagePicker"
import FormTagInput from "@components/Objects/StyledElements/Form/TagInput"
import { useTranslations } from 'next-intl'

const CreateCourseModal = ({ closeModal, orgslug }: any) => {
  const t = useTranslations('Components.CreateCourseModal')
  const router = useRouter()
  const session = useLHSession() as any
  const [orgId, setOrgId] = React.useState(null) as any
  const [showUnsplashPicker, setShowUnsplashPicker] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)

  const validationSchema = Yup.object().shape({
    name: Yup.string()
      .required(t('schemaNameRequired'))
      .max(100, t('schemaNameMax')),
    description: Yup.string()
      .max(1000, t('schemaDescriptionMax')),
    learnings: Yup.string(),
    tags: Yup.string(),
    visibility: Yup.boolean(),
    thumbnail: Yup.mixed().nullable()
  })

  const formik = useFormik({
    initialValues: {
      name: '',
      description: '',
      learnings: '',
      visibility: true,
      tags: '',
      thumbnail: null
    },
    validationSchema,
    onSubmit: async (values, { setSubmitting }) => {
      const toast_loading = toast.loading(t('toastLoading'))

      try {
        const res = await createNewCourse(
          orgId,
          {
            name: values.name,
            description: values.description,
            learnings: values.learnings,
            tags: values.tags,
            visibility: values.visibility
          },
          values.thumbnail,
          session.data?.tokens?.access_token
        )

        if (res.success) {
          await revalidateTags(['courses'], orgslug)
          toast.dismiss(toast_loading)
          toast.success(t('toastSuccess'))

          if (res.data.org_id === orgId) {
            closeModal()
            router.refresh()
            await revalidateTags(['courses'], orgslug)
          }
        } else {
          toast.error(res.data.detail || t('toastError'))
        }
      } catch (error) {
        toast.error(t('toastError'))
      } finally {
        setSubmitting(false)
      }
    }
  })

  const getOrgMetadata = async () => {
    const org = await getOrganizationContextInfoWithoutCredentials(orgslug, {
      revalidate: 360,
      tags: ['organizations'],
    })
    setOrgId(org.id)
  }

  useEffect(() => {
    if (orgslug) {
      getOrgMetadata()
    }
  }, [orgslug])

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      formik.setFieldValue('thumbnail', file)
    }
  }

  const handleUnsplashSelect = async (imageUrl: string) => {
    setIsUploading(true)
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const file = new File([blob], 'unsplash_image.jpg', { type: 'image/jpeg' })
      formik.setFieldValue('thumbnail', file)
    } catch (error) {
      toast.error(t('toastErrorUnsplash'))
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <FormLayout onSubmit={formik.handleSubmit} >
      <FormField name="name">
        <FormLabelAndMessage
          label={t('labelName')}
          message={(formik.touched.name && formik.errors.name) || undefined}
        />
        <Form.Control asChild>
          <Input
            onChange={formik.handleChange}
            value={formik.values.name}
            type="text"
            required
          />
        </Form.Control>
      </FormField>

      <FormField name="description">
        <FormLabelAndMessage
          label={t('labelDescription')}
          message={(formik.touched.description && formik.errors.description) || undefined}
        />
        <Form.Control asChild>
          <Textarea
            onChange={formik.handleChange}
            value={formik.values.description}
          />
        </Form.Control>
      </FormField>

      <FormField name="thumbnail">
        <FormLabelAndMessage
          label={t('labelThumbnail')}
          message={(formik.touched.thumbnail && typeof formik.errors.thumbnail === 'string' ? formik.errors.thumbnail : undefined)}
        />
        <div className="w-auto bg-gray-50 rounded-xl outline outline-1 outline-gray-200 h-[200px] shadow-sm">
          <div className="flex flex-col justify-center items-center h-full">
            <div className="flex flex-col justify-center items-center">
              {formik.values.thumbnail ? (
                <img
                  src={URL.createObjectURL(formik.values.thumbnail)}
                  className={`${isUploading ? 'animate-pulse' : ''} shadow-sm w-[200px] h-[100px] rounded-md`}
                />
              ) : (
                <img
                  src="/empty_thumbnail.png"
                  className="shadow-sm w-[200px] h-[100px] rounded-md bg-gray-200"
                />
              )}
              <div className="flex justify-center items-center space-x-2">
                <input
                  type="file"
                  id="fileInput"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                  accept="image/*"
                />
                <button
                  type="button"
                  className="font-bold antialiased items-center text-gray text-sm rounded-md px-4 mt-6 flex"
                  onClick={() => document.getElementById('fileInput')?.click()}
                >
                  <UploadCloud size={16} className="mr-2" />
                  <span>{t('thumbnailUpload')}</span>
                </button>
                <button
                  type="button"
                  className="font-bold antialiased items-center text-gray text-sm rounded-md px-4 mt-6 flex"
                  onClick={() => setShowUnsplashPicker(true)}
                >
                  <ImageIcon size={16} className="mr-2" />
                  <span>{t('thumbnailChoose')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </FormField>

      <FormField name="learnings">
        <FormLabelAndMessage
          label={t('labelLearnings')}
          message={(formik.touched.learnings && typeof formik.errors.learnings === 'string' ? formik.errors.learnings : undefined)}
        />
        <FormTagInput
          placeholder={t('placeholderLearnings')}
          value={formik.values.learnings}
          onChange={(value) => formik.setFieldValue('learnings', value)}
          error={(formik.touched.learnings && typeof formik.errors.learnings === 'string' ? formik.errors.learnings : undefined)}
        />
      </FormField>

      <FormField name="tags">
        <FormLabelAndMessage
          label={t('labelTags')}
          message={(formik.touched.tags && typeof formik.errors.tags === 'string' ? formik.errors.tags : undefined)}
        />
        <FormTagInput
          placeholder={t('placeholderTags')}
          value={formik.values.tags}
          onChange={(value) => formik.setFieldValue('tags', value)}
          error={(formik.touched.tags && typeof formik.errors.tags === 'string' ? formik.errors.tags : undefined)}
        />
      </FormField>

      <FormField name="visibility">
        <FormLabelAndMessage
          label={t('labelVisibility')}
          message={(formik.touched.visibility && typeof formik.errors.visibility === 'string' ? formik.errors.visibility : undefined)}
        />
        <Select
          value={formik.values.visibility.toString()}
          onValueChange={(value) => formik.setFieldValue('visibility', value === 'true')}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('placeholderVisibility')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">{t('visibilityItemPublic')}</SelectItem>
            <SelectItem value="false">{t('visibilityItemPrivate')}</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <div className="flex justify-end mt-6">
        <button
          type="submit"
          disabled={formik.isSubmitting}
          className="px-4 py-2 bg-black text-white text-sm font-bold rounded-md"
        >
          {formik.isSubmitting ? (
            <BarLoader
              cssOverride={{ borderRadius: 60 }}
              width={60}
              color="#ffffff"
            />
          ) : (
            t('createCourse')
          )}
        </button>
      </div>

      {showUnsplashPicker && (
        <UnsplashImagePicker
          onSelect={handleUnsplashSelect}
          onClose={() => setShowUnsplashPicker(false)}
        />
      )}
    </FormLayout>
  )
}

export default CreateCourseModal
