'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Image as ImageIcon, UploadCloud } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { BarLoader } from 'react-spinners';
import { z } from 'zod';

import { useLHSession } from '@components/Contexts/LHSessionContext';
import UnsplashImagePicker from '@components/Dashboard/Pages/Course/EditCourseGeneral/UnsplashImagePicker';
import FormTagInput from '@components/Objects/StyledElements/Form/TagInput';
import { Button } from '@components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
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

  const validationSchema = z.object({
    name: z.string().min(1, t('schemaNameRequired')).max(100, t('schemaNameMax')),
    description: z.string().max(1000, t('schemaDescriptionMax')).optional().or(z.literal('')),
    learnings: z.string().optional().or(z.literal('')),
    tags: z.string().optional().or(z.literal('')),
    visibility: z.boolean(),
    thumbnail: z.any().nullable(),
  });

  type FormValues = z.infer<typeof validationSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      name: '',
      description: '',
      learnings: '',
      visibility: true,
      tags: '',
      thumbnail: null,
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

  const onSubmit = async (values: FormValues) => {
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
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      form.setValue('thumbnail', file);
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
      form.setValue('thumbnail', file);
    } catch {
      toast.error(t('toastErrorUnsplash'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('labelName')}</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder={t('placeholderName')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('labelDescription')}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t('placeholderDescription')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="thumbnail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('labelThumbnail')}</FormLabel>
              <FormControl>
                <div className="h-[200px] w-auto rounded-xl bg-gray-50 shadow-sm outline-gray-200">
                  <div className="flex h-full flex-col items-center justify-center">
                    <div className="flex flex-col items-center justify-center">
                      {form.watch('thumbnail') ? (
                        <img
                          src={URL.createObjectURL(form.watch('thumbnail') as File)}
                          alt={`Thumbnail preview for ${form.watch('name') || 'course'}`}
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
                        <Button
                          type="button"
                          variant="ghost"
                          className="mt-6"
                          onClick={() => document.getElementById('fileInput')?.click()}
                        >
                          <UploadCloud
                            size={16}
                            className="mr-2"
                          />
                          <span>{t('thumbnailUpload')}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="mt-6"
                          onClick={() => setShowUnsplashPicker(true)}
                        >
                          <ImageIcon
                            size={16}
                            className="mr-2"
                          />
                          <span>{t('thumbnailChoose')}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="learnings"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('labelLearnings')}</FormLabel>
              <FormControl>
                <FormTagInput
                  placeholder={t('placeholderLearnings')}
                  value={field.value || ''}
                  onChange={field.onChange}
                  error={form.formState.errors.learnings?.message}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tags"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('labelTags')}</FormLabel>
              <FormControl>
                <FormTagInput
                  placeholder={t('placeholderTags')}
                  value={field.value || ''}
                  onChange={field.onChange}
                  error={form.formState.errors.tags?.message}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="visibility"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('labelVisibility')}</FormLabel>
              <Select
                value={field.value.toString()}
                onValueChange={(value) => field.onChange(value === 'true')}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('placeholderVisibility')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="true">{t('visibilityItemPublic')}</SelectItem>
                  <SelectItem value="false">{t('visibilityItemPrivate')}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? (
              <BarLoader
                cssOverride={{ borderRadius: 60 }}
                width={60}
                color="#ffffff"
              />
            ) : (
              t('createCourse')
            )}
          </Button>
        </div>

        {showUnsplashPicker && (
          <UnsplashImagePicker
            onSelect={handleUnsplashSelect}
            onClose={() => setShowUnsplashPicker(false)}
          />
        )}
      </form>
    </Form>
  );
};

export default CreateCourseModal;
