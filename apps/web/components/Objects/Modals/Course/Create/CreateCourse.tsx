'use client';

import UnsplashImagePicker from '@components/Dashboard/Pages/Course/EditCourseGeneral/UnsplashImagePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
import { getOrganizationContextInfoWithoutCredentials } from '@services/organizations/orgs';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { BarLoader } from '@components/Objects/Loaders/BarLoader';
import { Image as ImageIcon, UploadCloud } from 'lucide-react';
import { TagsInput } from '@components/ui/custom/tags-input';
import { revalidateTags } from '@services/utils/ts/requests';
import { createNewCourse } from '@services/courses/courses';
import { zodResolver } from '@hookform/resolvers/zod';
import { Textarea } from '@components/ui/textarea';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import type { ChangeEvent } from 'react';
import { toast } from 'sonner';
import * as z from 'zod';

const CreateCourseModal = ({ closeModal, orgslug }: any) => {
  const t = useTranslations('Components.CreateCourseModal');
  const router = useRouter();
  const session = usePlatformSession() as any;
  const [orgId, setOrgId] = useState<number | null>(null);
  const [showUnsplashPicker, setShowUnsplashPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const validationSchema = z.object({
    name: z.string().min(1, t('schemaNameRequired')).max(100, t('schemaNameMax')),
    description: z.string().min(10, t('schemaDescriptionMin')).max(1000, t('schemaDescriptionMax')),
    learnings: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    visibility: z.boolean(),
    thumbnail: z.any().nullable(),
  });

  type FormValues = z.infer<typeof validationSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      name: '',
      description: '',
      learnings: [],
      visibility: true,
      tags: [],
      thumbnail: null,
    },
  });

  const getOrgMetadata = useCallback(async () => {
    const org = await getOrganizationContextInfoWithoutCredentials(orgslug, {
      revalidate: 360,
      tags: ['organizations'],
    });
    setOrgId(org.id);
  }, [orgslug]);

  useEffect(() => {
    if (orgslug) {
      getOrgMetadata();
    }
  }, [orgslug, getOrgMetadata]);

  const [isPending, startTransition] = useTransition();

  const onSubmit = (values: FormValues) => {
    if (orgId === null) {
      toast.error(t('toastErrorOrgMissing'));
      return;
    }
    const toast_loading = toast.loading(t('toastLoading'));

    startTransition(() => {
      void (async () => {
        try {
          const res = await createNewCourse(
            orgId,
            {
              name: values.name,
              description: values.description || '',
              learnings: values.learnings?.join(', ') || '',
              tags: values.tags?.join(', ') || '',
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
            toast.dismiss(toast_loading);
            const detail = res.data.detail;
            // Handle Pydantic validation errors (array of {type, loc, msg, input})
            const errorMessage =
              typeof detail === 'string'
                ? detail
                : Array.isArray(detail)
                  ? detail.map((e: { msg?: string }) => e.msg).join(', ')
                  : t('toastError');
            toast.error(errorMessage || t('toastError'));
          }
        } catch {
          toast.error(t('toastError'));
        }
      })();
    });
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
                <Textarea {...field} />
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
                <div className="bg-background h-[200px] w-auto rounded-xl shadow-sm outline-gray-200">
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
                          src="/empty_thumbnail.webp"
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
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          aria-label={t('ariaLabel')}
                          title={t('selectFile')}
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
                          onClick={() => {
                            setShowUnsplashPicker(true);
                          }}
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
                <TagsInput
                  placeholder={t('placeholderLearnings')}
                  value={field.value || []}
                  onValueChange={field.onChange}
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
                <TagsInput
                  placeholder={t('placeholderTags')}
                  value={field.value || []}
                  onValueChange={field.onChange}
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
                value={String(field.value ?? true)}
                onValueChange={(value) => {
                  field.onChange(value === 'true');
                }}
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
            disabled={isPending || form.formState.isSubmitting}
          >
            {isPending || form.formState.isSubmitting ? (
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

        {showUnsplashPicker ? (
          <UnsplashImagePicker
            onSelect={handleUnsplashSelect}
            onClose={() => {
              setShowUnsplashPicker(false);
            }}
          />
        ) : null}
      </form>
    </Form>
  );
};

export default CreateCourseModal;
