'use client';
import * as Form from '@radix-ui/react-form';
import { useFormik } from 'formik';
import { Image as ImageIcon, UploadCloud } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { toast } from 'react-hot-toast';
import { BarLoader } from 'react-spinners';
import * as Yup from 'yup';

import { useLHSession } from '@components/Contexts/LHSessionContext';
import UnsplashImagePicker from '@components/Dashboard/Pages/Course/EditCourseGeneral/UnsplashImagePicker';
import FormLayout, { FormField, FormLabelAndMessage } from '@components/Objects/StyledElements/Form/Form';
import FormTagInput from '@components/Objects/StyledElements/Form/TagInput';
import { Input } from '@components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Textarea } from '@components/ui/textarea';
import { createNewCourse } from '@services/courses/courses';
import { getOrganizationContextInfoWithoutCredentials } from '@services/organizations/orgs';
import { revalidateTags } from '@services/utils/ts/requests';

const CreateCourseModal = ({ closeModal, orgslug }: any) => {
  const t = useTranslations('Components.CreateCourseModal');
  const router = useRouter();
  const session = useLHSession() as any;
  const [orgId, setOrgId] = useState(null) as any;
  const [showUnsplashPicker, setShowUnsplashPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const validationSchema = Yup.object().shape({
    name: Yup.string().required(t('schemaNameRequired')).max(100, t('schemaNameMax')),
    description: Yup.string().max(1000, t('schemaDescriptionMax')),
    learnings: Yup.string(),
    tags: Yup.string(),
    visibility: Yup.boolean(),
    thumbnail: Yup.mixed().nullable(),
  });

  const formik = useFormik({
    initialValues: {
      name: '',
      description: '',
      learnings: '',
      visibility: true,
      tags: '',
      thumbnail: null,
    },
    validationSchema,
    onSubmit: async (values, { setSubmitting }) => {
      const toast_loading = toast.loading(t('toastLoading'));

      try {
        const res = await createNewCourse(
          orgId,
          {
            name: values.name,
            description: values.description,
            learnings: values.learnings,
            tags: values.tags,
            visibility: values.visibility,
          },
          values.thumbnail,
          session.data?.tokens?.access_token,
        );

        if (res.success) {
          await revalidateTags(['courses'], orgslug);
          toast.dismiss(toast_loading);
          toast.success(t('toastSuccess'));

          if (res.data.org_id === orgId) {
            closeModal();
            router.refresh();
            await revalidateTags(['courses'], orgslug);
          }
        } else {
          toast.error(res.data.detail || t('toastError'));
        }
      } catch {
        toast.error(t('toastError'));
      } finally {
        setSubmitting(false);
      }
    },
  });
  const getOrgMetadata = useCallback(async () => {
    const org = await getOrganizationContextInfoWithoutCredentials(orgslug, {
      revalidate: 360,
      tags: ['organizations'],
    });
    setOrgId(org.id);
  }, [orgslug, setOrgId]);

  useEffect(() => {
    if (orgslug) {
      getOrgMetadata();
    }
  }, [orgslug, getOrgMetadata]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      formik.setFieldValue('thumbnail', file);
    }
  };

  const handleUnsplashSelect = async (imageUrl: string) => {
    setIsUploading(true);
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], 'unsplash_image.jpg', {
        type: 'image/jpeg',
      });
      formik.setFieldValue('thumbnail', file);
    } catch {
      toast.error(t('toastErrorUnsplash'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <FormLayout onSubmit={formik.handleSubmit}>
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
          message={
            formik.touched.thumbnail && typeof formik.errors.thumbnail === 'string'
              ? formik.errors.thumbnail
              : undefined
          }
        />
        <div className="h-[200px] w-auto rounded-xl bg-gray-50 shadow-sm outline-gray-200">
          <div className="flex h-full flex-col items-center justify-center">
            <div className="flex flex-col items-center justify-center">
              {formik.values.thumbnail ? (
                <img
                  src={URL.createObjectURL(formik.values.thumbnail)}
                  alt={`Thumbnail preview for ${formik.values.name || 'course'}`}
                  className={`${isUploading ? 'animate-pulse' : ''} h-[100px] w-[200px] rounded-md shadow-sm`}
                />
              ) : (
                <img
                  src="/empty_thumbnail.png"
                  alt=""
                  className="h-[100px] w-[200px] rounded-md bg-gray-200 shadow-sm"
                />
              )}
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
                  <UploadCloud
                    size={16}
                    className="mr-2"
                  />
                  <span>{t('thumbnailUpload')}</span>
                </button>
                <button
                  type="button"
                  className="text-gray mt-6 flex items-center rounded-md px-4 text-sm font-bold antialiased"
                  onClick={() => setShowUnsplashPicker(true)}
                >
                  <ImageIcon
                    size={16}
                    className="mr-2"
                  />
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
          message={
            formik.touched.learnings && typeof formik.errors.learnings === 'string'
              ? formik.errors.learnings
              : undefined
          }
        />
        <FormTagInput
          placeholder={t('placeholderLearnings')}
          value={formik.values.learnings}
          onChange={(value) => formik.setFieldValue('learnings', value)}
          error={
            formik.touched.learnings && typeof formik.errors.learnings === 'string'
              ? formik.errors.learnings
              : undefined
          }
        />
      </FormField>

      <FormField name="tags">
        <FormLabelAndMessage
          label={t('labelTags')}
          message={formik.touched.tags && typeof formik.errors.tags === 'string' ? formik.errors.tags : undefined}
        />
        <FormTagInput
          placeholder={t('placeholderTags')}
          value={formik.values.tags}
          onChange={(value) => formik.setFieldValue('tags', value)}
          error={formik.touched.tags && typeof formik.errors.tags === 'string' ? formik.errors.tags : undefined}
        />
      </FormField>

      <FormField name="visibility">
        <FormLabelAndMessage
          label={t('labelVisibility')}
          message={
            formik.touched.visibility && typeof formik.errors.visibility === 'string'
              ? formik.errors.visibility
              : undefined
          }
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

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={formik.isSubmitting}
          className="rounded-md bg-black px-4 py-2 text-sm font-bold text-white"
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
  );
};

export default CreateCourseModal;
