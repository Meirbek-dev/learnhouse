'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext';
import FormTagInput from '@components/Objects/StyledElements/Form/TagInput';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
import { Input } from '@components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Textarea } from '@components/ui/textarea';

import LearningItemsList from './LearningItemsList';
import ThumbnailUpdate from './ThumbnailUpdate';

interface EditCourseStructureProps {
  orgslug: string;
  course_uuid?: string;
}

interface MyCourseFormValues {
  name: string;
  description: string;
  about: string;
  learnings: string;
  tags: string;
  public: boolean;
  thumbnail_type: 'image' | 'video' | 'both';
}

const createValidationSchema = (t: (key: string, values?: any) => string) =>
  z.object({
    name: z
      .string()
      .min(1, t('errors.required', { fieldName: t('name.label') }))
      .max(100, t('errors.maxLength', { count: 100 })),
    description: z
      .string()
      .min(1, t('errors.required', { fieldName: t('description.label') }))
      .max(1000, t('errors.maxLength', { count: 1000 })),
    about: z.string().optional(),
    learnings: z
      .string()
      .min(1, t('errors.required', { fieldName: t('learnings.label') }))
      .refine((value) => {
        try {
          const learningItems = JSON.parse(value);
          if (!Array.isArray(learningItems)) {
            return false;
          }
          if (learningItems.length === 0) {
            return false;
          }
          const hasEmptyText = learningItems.some((item: any) => !item.text || item.text.trim() === '');
          return !hasEmptyText;
        } catch {
          return false;
        }
      }, t('errors.invalidJsonFormat')),
    tags: z.string().optional(),
    public: z.boolean(),
    thumbnail_type: z.enum(['image', 'video', 'both']),
  });

// Initialize learnings as a JSON array if it's not already
const initializeLearnings = (learnings: any) => {
  if (!learnings) {
    return JSON.stringify([{ id: 'initial-learning-item', text: '', emoji: '📝' }]);
  }

  try {
    // Check if it's already a valid JSON array
    const parsed = JSON.parse(learnings);
    if (Array.isArray(parsed)) {
      return learnings;
    }

    // If it's a string but not a JSON array, convert it to a learning item
    if (typeof learnings === 'string') {
      return JSON.stringify([
        {
          id: 'initial-learning-item',
          text: learnings,
          emoji: '📝',
        },
      ]);
    }

    // Default empty array
    return JSON.stringify([{ id: 'init-learn-item', text: '', emoji: '📝' }]);
  } catch {
    // If it's not valid JSON, convert the string to a learning item
    if (typeof learnings === 'string') {
      return JSON.stringify([
        {
          id: 'init-learn-item-from-string',
          text: learnings,
          emoji: '📝',
        },
      ]);
    }

    // Default empty array
    return JSON.stringify([{ id: 'init-new-learn-item', text: '', emoji: '📝' }]);
  }
};
function EditCourseGeneral(props: EditCourseStructureProps) {
  const [error, setError] = useState('');
  const course = useCourse();
  const dispatchCourse = useCourseDispatch() as any;
  const { isLoading, courseStructure } = course as any;
  const t = useTranslations('CourseEdit.General');
  const thumbnailType = courseStructure?.thumbnail_type || 'image';
  const validationSchema = createValidationSchema(t);

  const form = useForm<MyCourseFormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      name: courseStructure?.name || '',
      description: courseStructure?.description || '',
      about: courseStructure?.about || '',
      learnings: initializeLearnings(courseStructure?.learnings || ''),
      tags: courseStructure?.tags || '',
      public: courseStructure?.public,
      thumbnail_type: thumbnailType,
    },
  });

  const handleSubmit = async (values: MyCourseFormValues) => {
    try {
      dispatchCourse({ type: 'setIsSaved' });
    } catch {
      setError(t('errors.saveFailed'));
    }
  };

  // Reset form when courseStructure changes
  useEffect(() => {
    if (courseStructure && !isLoading) {
      const newValues = {
        name: courseStructure?.name || '',
        description: courseStructure?.description || '',
        about: courseStructure?.about || '',
        learnings: initializeLearnings(courseStructure?.learnings || ''),
        tags: courseStructure?.tags || '',
        public: courseStructure?.public,
        thumbnail_type: thumbnailType,
      };
      form.reset(newValues);
    }
  }, [courseStructure, isLoading, thumbnailType, form]);

  const watchedValues = form.watch();

  useEffect(() => {
    if (!isLoading) {
      const formValues = form.getValues();
      const defaultValues = form.formState.defaultValues;
      const valuesChanged = Object.keys(formValues).some(
        (key) => formValues[key as keyof MyCourseFormValues] !== defaultValues?.[key as keyof MyCourseFormValues],
      );

      if (valuesChanged) {
        dispatchCourse({ type: 'setIsNotSaved' });
        const updatedCourse = {
          ...courseStructure,
          ...formValues,
        };
        dispatchCourse({ type: 'setCourseStructure', payload: updatedCourse });
      }
    }
  }, [watchedValues, isLoading, courseStructure, dispatchCourse, form]);

  if (isLoading || !courseStructure) {
    return <div>{t('loading')}</div>;
  }

  return (
    <div className="h-full">
      <div className="h-6" />
      <div className="px-10 pb-10">
        <div className="shadow-xs rounded-xl bg-white">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="p-6"
            >
              {error && (
                <div className="shadow-xs mb-6 flex items-center justify-center space-x-2 rounded-md bg-red-200 p-4 text-red-950 transition-all">
                  <AlertTriangle size={18} />
                  <div className="text-sm font-bold">{error}</div>
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
                          style={{ backgroundColor: 'white' }}
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
                      <FormLabel>{t('description.label')}</FormLabel>
                      <FormControl>
                        <Input
                          style={{ backgroundColor: 'white' }}
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
                  name="about"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('about.label')}</FormLabel>
                      <FormControl>
                        <Textarea
                          style={{ backgroundColor: 'white', height: '200px', minHeight: '200px' }}
                          {...field}
                        />
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
                      <FormLabel>{t('tags.label')}</FormLabel>
                      <FormControl>
                        <FormTagInput
                          placeholder={t('tags.placeholder')}
                          onChange={field.onChange}
                          value={field.value}
                        />
                      </FormControl>
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
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="w-full bg-white">
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
                          <SelectContent>
                            <SelectItem value="image">{t('image')}</SelectItem>
                            <SelectItem value="video">{t('video')}</SelectItem>
                            <SelectItem value="both">{t('both')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <FormLabel>{t('thumbnail.label')}</FormLabel>
                  <ThumbnailUpdate thumbnailType={form.watch('thumbnail_type')} />
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
