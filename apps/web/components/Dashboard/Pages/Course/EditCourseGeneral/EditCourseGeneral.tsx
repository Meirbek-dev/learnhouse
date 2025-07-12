'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TagsInput } from '@components/ui/custom/tags-input';
import { revalidateTags } from '@services/utils/ts/requests';
import { updateCourse } from '@services/courses/courses';
import { zodResolver } from '@hookform/resolvers/zod';
import { getAPIUrl } from '@services/config/config';
import { Textarea } from '@components/ui/textarea';
import { Checkbox } from '@components/ui/checkbox';
import { Input } from '@components/ui/input';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { mutate } from 'swr';
import { z } from 'zod';

import LearningItemsList from './LearningItemsList';
import ThumbnailUpdate from './ThumbnailUpdate';

const generateId = () => crypto.randomUUID();

interface EditCourseGeneralProps {
  orgslug: string;
  course_uuid?: string;
}

const createCourseFormSchema = (t: any) =>
  z.object({
    name: z
      .string()
      .min(2, t('errors.required', { fieldName: t('name.label') }))
      .max(100, t('errors.maxLength', { count: 100 })),
    description: z
      .string()
      .min(2, t('errors.required', { fieldName: t('description.label') }))
      .max(1000, t('errors.maxLength', { count: 1000 })),
    about: z.string(),
    learnings: z
      .string()
      .min(1, t('errors.required', { fieldName: t('learnings.label') }))
      .refine((value) => {
        try {
          const learningItems = JSON.parse(value);
          return Array.isArray(learningItems) && learningItems.length > 0;
        } catch {
          return false;
        }
      }, t('errors.atLeastOneLearningItem'))
      .refine((value) => {
        try {
          const learningItems = JSON.parse(value);
          return !learningItems.some((item: any) => !item.text || item.text.trim() === '');
        } catch {
          return false;
        }
      }, t('errors.allLearningItemsMustHaveText')),
    tags: z.array(z.string()),
    public: z.boolean(),
    thumbnail_type: z.enum(['image', 'video', 'both']),
  });

function EditCourseGeneral(props: EditCourseGeneralProps) {
  const [error, setError] = useState('');
  const [isFormInitialized, setIsFormInitialized] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const initialValuesRef = useRef<any>(null);
  const courseStructureRef = useRef<any>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const course = useCourse();
  const dispatchCourse = useCourseDispatch() as any;
  const { isLoading, courseStructure } = course as any;
  const session = useLHSession() as any;
  const t = useTranslations('CourseEdit.General');

  const courseFormSchema = createCourseFormSchema(t);
  type CourseFormData = z.infer<typeof courseFormSchema>;

  const initializeLearnings = useCallback((learnings: any): string => {
    if (!learnings) {
      return JSON.stringify([{ id: generateId(), text: '', emoji: '📝' }]);
    }

    try {
      const parsed = JSON.parse(learnings);
      if (Array.isArray(parsed)) {
        return parsed.length > 0
          ? JSON.stringify(parsed.map((item: any) => Object.assign(item, { id: item.id || generateId() })))
          : JSON.stringify([{ id: generateId(), text: '', emoji: '📝' }]);
      }

      if (typeof learnings === 'string') {
        return JSON.stringify([{ id: generateId(), text: learnings, emoji: '📝' }]);
      }

      return JSON.stringify([{ id: generateId(), text: '', emoji: '📝' }]);
    } catch {
      if (typeof learnings === 'string') {
        return JSON.stringify([{ id: generateId(), text: learnings, emoji: '📝' }]);
      }

      return JSON.stringify([{ id: generateId(), text: '', emoji: '📝' }]);
    }
  }, []);

  const initializeTags = useCallback((tags: any): string[] => {
    if (!tags) return [];

    if (typeof tags === 'string') {
      return tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
    }

    if (Array.isArray(tags)) {
      return tags.filter((tag) => typeof tag === 'string' && tag.trim().length > 0);
    }

    return [];
  }, []);

  const form = useForm<CourseFormData>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
      name: '',
      description: '',
      about: '',
      learnings: JSON.stringify([{ id: generateId(), text: '', emoji: '📝' }]),
      tags: [],
      public: false,
      thumbnail_type: 'image',
    },
    mode: 'onChange',
  });

  const {
    watch,
    reset,
    formState: { errors, isDirty },
  } = form;

  // Watch all form values at once to prevent multiple rerenders
  const formValues = watch();
  const thumbnailType = formValues.thumbnail_type;

  useEffect(() => {
    courseStructureRef.current = courseStructure;
  }, [courseStructure]);

  useEffect(() => {
    if (courseStructure && !isLoading && !isFormInitialized) {
      // Ensure thumbnail_type always has a valid enum value
      const thumbnailType = courseStructure?.thumbnail_type || 'image';
      const validThumbnailType = (['image', 'video', 'both'] as const).includes(thumbnailType)
        ? (thumbnailType as 'image' | 'video' | 'both')
        : 'image';

      const newValues: CourseFormData = {
        name: courseStructure?.name || '',
        description: courseStructure?.description || '',
        about: courseStructure?.about || '',
        learnings: initializeLearnings(courseStructure?.learnings || ''),
        tags: initializeTags(courseStructure?.tags || ''),
        public: Boolean(courseStructure?.public),
        thumbnail_type: validThumbnailType,
      };

      initialValuesRef.current = newValues;
      reset(newValues);
      setIsFormInitialized(true);
    }
  }, [courseStructure?.course_uuid, isLoading, isFormInitialized, initializeLearnings, initializeTags, reset]);

  useEffect(() => {
    if (!isLoading && isDirty) {
      dispatchCourse({ type: 'setIsNotSaved' });
    }
  }, [isDirty, isLoading, dispatchCourse]);

  const withUnpublishedActivities = course ? course.withUnpublishedActivities : false;

  // Memoized auto-save function
  const autoSaveCourse = useCallback(
    async (courseData: any) => {
      if (!(session?.data?.tokens?.access_token && courseData.course_uuid)) return;

      try {
        setIsAutoSaving(true);
        mutate(
          `${getAPIUrl()}courses/${courseData.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
        );
        await updateCourse(courseData.course_uuid, courseData, session.data.tokens.access_token);
        await revalidateTags(['courses'], props.orgslug);
        dispatchCourse({ type: 'setIsSaved' });
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        setIsAutoSaving(false);
      }
    },
    [session, withUnpublishedActivities, props.orgslug, dispatchCourse],
  );

  // Single useEffect for auto-save logic
  useEffect(() => {
    if (!isLoading && isFormInitialized && initialValuesRef.current) {
      const hasChanges = JSON.stringify(formValues) !== JSON.stringify(initialValuesRef.current);

      if (hasChanges && !isAutoSaving) {
        // Clear existing timeout
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }

        // Set new timeout for auto-save
        autoSaveTimeoutRef.current = setTimeout(() => {
          const updatedCourseStructure = {
            ...courseStructureRef.current,
            ...formValues,
            tags: formValues.tags.join(', '), // Convert array back to string for API
          };

          dispatchCourse({ type: 'setCourseStructure', payload: updatedCourseStructure });
          autoSaveCourse(updatedCourseStructure);
        }, 2000); // 2 second delay
      }
    }
  }, [formValues, isLoading, isFormInitialized, dispatchCourse, autoSaveCourse]);

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Form submission handler
  const onSubmit = useCallback(
    async (data: CourseFormData) => {
      if (!(session?.data?.tokens?.access_token && courseStructure?.course_uuid)) return;

      try {
        setError('');
        const updatedCourseStructure = {
          ...courseStructure,
          ...data,
          tags: data.tags.join(', '), // Convert array back to string for API
        };

        mutate(
          `${getAPIUrl()}courses/${courseStructure.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
        );
        await updateCourse(courseStructure.course_uuid, updatedCourseStructure, session.data.tokens.access_token);
        await revalidateTags(['courses'], props.orgslug);

        dispatchCourse({ type: 'setCourseStructure', payload: updatedCourseStructure });
        dispatchCourse({ type: 'setIsSaved' });

        // Update initial values after successful save
        initialValuesRef.current = data;
      } catch (error: any) {
        setError(error?.message || t('errors.saveFailed'));
      }
    },
    [session, courseStructure, withUnpublishedActivities, props.orgslug, dispatchCourse, t],
  );

  if (isLoading || !courseStructure) {
    return <div className="flex h-64 items-center justify-center">{t('loading')}</div>;
  }

  return (
    <div className="h-full">
      <div className="h-6" />
      <div className="px-10 pb-10">
        <div className="shadow-xs rounded-xl bg-white">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="p-6">
                {error && (
                  <div className="mb-6 flex items-center rounded-md bg-red-50 p-4 text-red-700">
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    {error}
                  </div>
                )}

                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('name.label')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('name.placeholder')}
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
                        <FormLabel>{t('description.label')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('description.placeholder')}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="about"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('about.label')}</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
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
                        <FormLabel>{t('learnings.label')}</FormLabel>
                        <FormControl>
                          <LearningItemsList
                            value={field.value}
                            onChange={field.onChange}
                            error={errors.learnings?.message}
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
                        <FormLabel>{t('tags.label')}</FormLabel>
                        <FormControl>
                          <TagsInput
                            placeholder={t('tags.placeholder')}
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
                    name="public"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>{t('public.label')}</FormLabel>
                          <p className="text-muted-foreground text-sm">{t('public.description')}</p>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="thumbnail_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('thumbnailType')}</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue>
                                {field.value === 'image'
                                  ? t('image')
                                  : field.value === 'video'
                                    ? t('video')
                                    : field.value === 'both'
                                      ? t('both')
                                      : t('image')}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="image">{t('image')}</SelectItem>
                            <SelectItem value="video">{t('video')}</SelectItem>
                            <SelectItem value="both">{t('both')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Thumbnail Upload Section */}
                  <div className="space-y-4">
                    <FormLabel>{t('thumbnail.label')}</FormLabel>
                    <ThumbnailUpdate thumbnailType={thumbnailType} />
                  </div>
                </div>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}

export default EditCourseGeneral;
