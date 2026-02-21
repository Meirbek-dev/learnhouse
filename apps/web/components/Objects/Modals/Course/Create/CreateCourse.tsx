'use client';

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { Image as ImageIcon, Loader2, UploadCloud, X } from 'lucide-react';
import { TagsInput } from '@components/ui/custom/tags-input';
import { createNewCourse } from '@services/courses/courses';
import { useOrg } from '@components/Contexts/OrgContext';
import { Card, CardFooter } from '@components/ui/card';
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

const MAX_FILE_SIZE = 8_000_000; // 8MB
const VALID_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'] as const;

interface CreateCourseModalProps {
  closeModal: () => void;
  org_id: number;
  onCreated?: () => void | Promise<void>;
} // Note: parent must pass `org_id` to avoid an extra fetch. Use `onCreated` to run post-create work (e.g., revalidate tags)

const CreateCourseModal = ({ closeModal, org_id, onCreated }: CreateCourseModalProps) => {
  const t = useTranslations('Components.CreateCourseModal');

  // Parent should provide `org_id`, but fall back to Org context when missing
  const org = useOrg() as any;
  const orgId = org_id ?? org?.id;
  const router = useRouter();
  const session = usePlatformSession() as any;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  const validationSchema = z.object({
    name: z.string().min(1, t('schemaNameRequired')).max(100, t('schemaNameMax')),
    description: z.string().min(5, t('schemaDescriptionMin')).max(1000, t('schemaDescriptionMax')),
    learnings: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    visibility: z.boolean(),
    thumbnail: z
      .any()
      .nullable()
      .refine(
        (file) => {
          if (!file) return true;
          return file.size <= MAX_FILE_SIZE;
        },
        { message: t('thumbnailTooLarge') || 'File size must be less than 8MB' },
      )
      .refine(
        (file) => {
          if (!file) return true;
          return VALID_IMAGE_TYPES.includes(file.type);
        },
        { message: t('thumbnailInvalidType') || 'Invalid file type' },
      ),
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (thumbnailPreview) {
        URL.revokeObjectURL(thumbnailPreview);
      }
    };
  }, [thumbnailPreview]);

  const [isPending, startTransition] = useTransition();

  const onSubmit = useCallback(
    (values: FormValues) => {
      const toastId = toast.loading(t('toastLoading'));

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

            toast.dismiss(toastId);

            if (res.success) {
              toast.success(t('toastSuccess'));

              if (res.data.org_id === orgId) {
                try {
                  await Promise.resolve(onCreated?.());
                } catch (error) {
                  console.warn('onCreated callback failed:', error);
                }
                closeModal();
                router.refresh();
              }
            } else {
              const { detail } = res.data;
              const errorMessage =
                typeof detail === 'string'
                  ? detail
                  : Array.isArray(detail)
                    ? detail.map((e: { msg?: string }) => e.msg).join(', ')
                    : t('toastError');
              toast.error(errorMessage || t('toastError'));
            }
          } catch (error) {
            toast.dismiss(toastId);
            toast.error(t('toastError'));
            console.error('Course creation error:', error);
          }
        })();
      });
    },
    [t, orgId, session.data?.tokens?.access_token, closeModal, router, onCreated],
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) return;

      // Validate file
      if (!VALID_IMAGE_TYPES.includes(file.type as any)) {
        toast.error(t('thumbnailInvalidType') || 'Invalid file type. Please select a valid image.');
        event.target.value = '';
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.error(t('thumbnailTooLarge') || `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`);
        event.target.value = '';
        return;
      }

      // Revoke previous preview URL
      if (thumbnailPreview) {
        URL.revokeObjectURL(thumbnailPreview);
      }

      const previewUrl = URL.createObjectURL(file);
      setThumbnailPreview(previewUrl);
      form.setValue('thumbnail', file, { shouldValidate: true });
    },
    [form, thumbnailPreview, t],
  );

  const removeThumbnail = useCallback(() => {
    if (thumbnailPreview) {
      URL.revokeObjectURL(thumbnailPreview);
      setThumbnailPreview(null);
    }
    form.setValue('thumbnail', null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [form, thumbnailPreview]);

  const thumbnailValue = form.watch('thumbnail');

  const visibilityItems = [
    { value: 'true', label: t('visibilityItemPublic') },
    { value: 'false', label: t('visibilityItemPrivate') },
  ] as const;

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
                <Textarea
                  rows={4}
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
                <Card className="overflow-hidden pt-0 min-w-100">
                  <div className="bg-card/5 relative aspect-video w-full">
                    {thumbnailValue ? (
                      <>
                        <img
                          src={thumbnailPreview || URL.createObjectURL(thumbnailValue)}
                          alt={t('thumbnailPreviewAlt') || 'Thumbnail preview'}
                          className={`h-full w-full object-cover ${isUploading ? 'animate-pulse' : ''}`}
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8 shadow-sm"
                          onClick={removeThumbnail}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <div className="bg-card/5 flex h-full flex-col items-center justify-center">
                        <ImageIcon className="text-card-foreground/60 mb-2 h-12 w-12" />
                        <p className="text-card-foreground/60 text-sm">{t('noThumbnail') || 'No thumbnail selected'}</p>
                      </div>
                    )}
                  </div>

                  <CardFooter className="bg-card/5 gap-2 border-t px-4 py-0">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileChange}
                      accept={VALID_IMAGE_TYPES.join(',')}
                      aria-label={t('ariaLabel')}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      <UploadCloud className="mr-2 h-4 w-4" />
                      {t('thumbnailUpload')}
                    </Button>
                  </CardFooter>
                </Card>
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
                onValueChange={(value) => field.onChange(value === 'true')}
                items={visibilityItems}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('placeholderVisibility')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    {visibilityItems.map((item) => (
                      <SelectItem
                        key={item.value}
                        value={item.value}
                      >
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={closeModal}
            disabled={isPending || form.formState.isSubmitting}
          >
            {t('cancel') || 'Cancel'}
          </Button>
          <Button
            type="submit"
            disabled={isPending || form.formState.isSubmitting || isUploading}
          >
            {isPending || form.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('creating') || 'Creating...'}
              </>
            ) : (
              t('createCourse')
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default CreateCourseModal;
