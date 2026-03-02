'use client';

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
import { AlertTriangle, BookOpen, Image as ImageIcon, Loader2, Tag, Video } from 'lucide-react';
import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext';
import { Card, CardContent, CardHeader } from '@components/ui/card';
import { TagsInput } from '@components/ui/custom/tags-input';
import { useEffect, useId, useRef, useState } from 'react';
import { Separator } from '@components/ui/separator';
import LearningItemsList from './LearningItemsList';
import { Textarea } from '@components/ui/textarea';
import ThumbnailUpdate from './ThumbnailUpdate';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import { generateUUID } from '@/lib/utils';
import { useForm } from 'react-hook-form';

const generateId = () => generateUUID();

interface EditCourseStructureProps {
  orgslug: string;
  course_uuid?: string;
}

interface FormValues {
  name: string;
  description: string;
  about: string;
  learnings: string;
  tags: string[];
  public: boolean;
  thumbnail_type: 'image' | 'video' | 'both';
}

const validateValues = (values: FormValues, t: any) => {
  const errors: Partial<Record<keyof FormValues, string>> = {};
  const errT = (key: string, params?: any) => t(`errors.${key}`, params);

  if (!values.name?.trim()) {
    errors.name = errT('required', { fieldName: t('name.label') });
  } else if (values.name.length > 100) {
    errors.name = errT('maxLength', { count: 100 });
  }

  if (!values.description?.trim()) {
    errors.description = errT('required', { fieldName: t('description.label') });
  } else if (values.description.length > 1000) {
    errors.description = errT('maxLength', { count: 1000 });
  }

  if (!values.learnings) {
    errors.learnings = errT('required', { fieldName: t('learnings.label') });
  } else {
    try {
      const arr = JSON.parse(values.learnings);
      if (!Array.isArray(arr)) {
        errors.learnings = errT('invalidFormat');
      } else if (arr.length === 0) {
        errors.learnings = errT('atLeastOneLearningItem');
      } else if (arr.some((i: any) => !i.text?.trim())) {
        errors.learnings = errT('allLearningItemsMustHaveText');
      }
    } catch {
      errors.learnings = errT('invalidJsonFormat');
    }
  }

  return errors;
};

function EditCourseGeneral(_props: EditCourseStructureProps) {
  const t = useTranslations('CourseEdit.General');
  const [error, setError] = useState('');

  const thumbnailTypeItems = [
    {
      value: 'image',
      label: (
        <div className="flex items-center gap-2">
          <ImageIcon
            className="h-4 w-4"
            aria-hidden="true"
          />
          {t('image')}
        </div>
      ),
    },
    {
      value: 'video',
      label: (
        <div className="flex items-center gap-2">
          <Video
            className="h-4 w-4"
            aria-hidden="true"
          />
          {t('video')}
        </div>
      ),
    },
    {
      value: 'both',
      label: (
        <div className="flex items-center gap-2">
          <ImageIcon
            className="h-4 w-4"
            aria-hidden="true"
          />
          <Video
            className="h-4 w-4"
            aria-hidden="true"
          />
          {t('both')}
        </div>
      ),
    },
  ];
  const course = useCourse();
  const dispatchCourse = useCourseDispatch();
  const { isLoading, courseStructure } = course;
  const formId = useId();

  const getInitialValues = (): FormValues => {
    const initializeLearnings = (learnings: any) => {
      if (!learnings) return JSON.stringify([{ id: generateId(), text: '', emoji: '📝' }]);
      try {
        const parsed = JSON.parse(learnings);
        if (Array.isArray(parsed)) return learnings;
      } catch {
        if (typeof learnings === 'string') {
          return JSON.stringify([{ id: generateId(), text: learnings, emoji: '📝' }]);
        }
      }
      return JSON.stringify([{ id: generateId(), text: '', emoji: '📝' }]);
    };

    const parseTags = (raw: any): string[] => {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw as string[];
      if (typeof raw === 'string') {
        return raw
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean);
      }
      return [];
    };

    return {
      name: courseStructure?.name || '',
      description: courseStructure?.description || '',
      about: courseStructure?.about || '',
      learnings: initializeLearnings(courseStructure?.learnings || ''),
      tags: parseTags(courseStructure?.tags),
      public: courseStructure?.public ?? false,
      thumbnail_type: courseStructure?.thumbnail_type || 'image',
    };
  };

  const form = useForm<FormValues>({
    defaultValues: getInitialValues(),
    mode: 'onChange',
  });

  const initialRef = useRef<FormValues>(form.getValues());

  // Reset when backend data changes
  useEffect(() => {
    if (!isLoading && courseStructure) {
      // Inline initial values computation to avoid adding a non-stable function to deps
      const initializeLearnings = (learnings: any) => {
        if (!learnings) return JSON.stringify([{ id: generateId(), text: '', emoji: '📝' }]);
        try {
          const parsed = JSON.parse(learnings);
          if (Array.isArray(parsed)) return learnings;
        } catch {
          if (typeof learnings === 'string') {
            return JSON.stringify([{ id: generateId(), text: learnings, emoji: '📝' }]);
          }
        }
        return JSON.stringify([{ id: generateId(), text: '', emoji: '📝' }]);
      };

      const parseTags = (raw: any): string[] => {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw as string[];
        if (typeof raw === 'string') {
          return raw
            .split(',')
            .map((t: string) => t.trim())
            .filter(Boolean);
        }
        return [];
      };

      const vals: FormValues = {
        name: courseStructure?.name || '',
        description: courseStructure?.description || '',
        about: courseStructure?.about || '',
        learnings: initializeLearnings(courseStructure?.learnings || ''),
        tags: parseTags(courseStructure?.tags),
        public: courseStructure?.public ?? false,
        thumbnail_type: courseStructure?.thumbnail_type || 'image',
      };

      form.reset(vals);
      initialRef.current = vals;
      setError('');
    }
  }, [isLoading, courseStructure, form]);

  // Watch for unsaved changes & sync context
  useEffect(() => {
    const sub = form.watch((values) => {
      if (isLoading) return;
      const errors = validateValues(values as FormValues, t);
      // set field errors imperatively
      (Object.keys(values) as (keyof FormValues)[]).forEach((k) => {
        if (errors[k]) form.setError(k, { message: errors[k] });
        else form.clearErrors(k);
      });
      const changed = JSON.stringify(values) !== JSON.stringify(initialRef.current);
      if (changed) {
        dispatchCourse({ type: 'setIsNotSaved' });
        dispatchCourse({
          type: 'setCourseStructure',
          payload: {
            ...courseStructure,
            ...values,
            tags: values.tags?.filter((tag): tag is string => tag !== undefined) ?? [],
          },
        });
      }
    });
    return () => sub.unsubscribe();
  }, [form, isLoading, dispatchCourse, courseStructure, t]);

  const handleSubmit = (values: FormValues) => {
    const errors = validateValues(values, t);
    if (Object.keys(errors).length > 0) {
      setError(t('errors.saveFailed'));
      // Focus on the first field with an error for better accessibility
      const firstErrorField = Object.keys(errors)[0] as keyof FormValues;
      form.setFocus(firstErrorField);
      return;
    }
    dispatchCourse({ type: 'setIsSaved' });
    setError('');
  };

  if (isLoading || !courseStructure) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex animate-pulse items-center rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-gray-600">
          <Loader2
            size={16}
            className="text-primary mr-2 animate-spin"
          />
          <span>{t('loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-auto space-y-8 p-6"
      role="main"
      aria-labelledby="course-edit-title"
    >
      <Form {...form}>
        <form
          id={formId}
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-6"
          noValidate
        >
          {error && (
            <Card
              className="border-destructive/50 bg-destructive/5"
              role="alert"
            >
              <CardContent className="p-4">
                <div
                  id={`${formId}-error`}
                  className="text-destructive flex items-center space-x-2"
                >
                  <AlertTriangle
                    className="h-5 w-5"
                    aria-hidden="true"
                  />
                  <span className="font-medium">{error}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              {/* Header Section */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h1
                    id="course-edit-title"
                    className="flex items-center gap-2 text-2xl font-bold tracking-tight"
                  >
                    <BookOpen
                      className="text-primary h-8 w-8"
                      aria-hidden="true"
                    />
                    {t('title', { courseName: courseStructure.name || '' })}
                  </h1>
                  <p className="text-muted-foreground text-base">{t('subtitle')}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Information Section */}
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">{t('name.label')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t('name.placeholder')}
                          className="text-lg"
                          maxLength={100}
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
                      <FormLabel className="text-base font-semibold">{t('description.label')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t('description.placeholder')}
                          maxLength={1000}
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
                      <FormLabel className="text-base font-semibold">{t('about.label')}</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          className="min-h-[120px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <FormField
                  control={form.control}
                  name="learnings"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">{t('learnings.label')}</FormLabel>
                      <FormControl>
                        <div
                          role="group"
                          aria-labelledby="learnings-label"
                        >
                          <LearningItemsList
                            value={field.value}
                            onChange={field.onChange}
                            error={form.formState.errors.learnings?.message}
                          />
                        </div>
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
                      <FormLabel className="flex items-center gap-2 text-base font-semibold">
                        <Tag
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                        {t('tags.label')}
                      </FormLabel>
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
              </div>

              <Separator />

              {/* Thumbnail Section */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="thumbnail_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">{t('thumbnailType')}</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          items={thumbnailTypeItems}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {thumbnailTypeItems.map((item) => (
                                <SelectItem
                                  key={String(item.value)}
                                  value={item.value}
                                >
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
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
                      <FormLabel className="flex justify-center text-base font-semibold">
                        {t('thumbnail.label')}
                      </FormLabel>
                      <FormControl>
                        <ThumbnailUpdate thumbnailType={field.value} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}

export default EditCourseGeneral;
