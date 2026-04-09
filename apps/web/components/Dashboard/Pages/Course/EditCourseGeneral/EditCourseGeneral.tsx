'use client';

import { useForm, useStore } from '@tanstack/react-form';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { AlertTriangle, Image as ImageIcon, Loader2, Tag, Video } from 'lucide-react';
import { SectionHeader } from '@components/Dashboard/Courses/SectionHeader';
import { useCoursesMutations } from '@/hooks/mutations/useCoursesMutations';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Field, FieldError, FieldLabel } from '@components/ui/field';
import { Card, CardContent, CardHeader } from '@components/ui/card';
import type { CourseGeneralValues } from '@/schemas/courseSchemas';
import { useSyncDirtySection } from '@/hooks/useSyncDirtySection';
import { useCourse } from '@components/Contexts/CourseContext';
import { courseGeneralSchema } from '@/schemas/courseSchemas';
import { TagsInput } from '@components/ui/custom/tags-input';
import { useEffect, useId, useMemo, useState } from 'react';
import { useSaveSection } from '@/hooks/useSaveSection';
import { Separator } from '@components/ui/separator';
import LearningItemsList from './LearningItemsList';
import { Textarea } from '@components/ui/textarea';
import ThumbnailUpdate from './ThumbnailUpdate';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import { generateUUID } from '@/lib/utils';

const generateId = () => generateUUID();

function initializeLearnings(learnings: any): string {
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
}

function parseTags(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((tag) => String(tag).trim()).filter(Boolean);
    } catch {
      // Fallback to legacy comma-separated data
    }
    return raw
      .split(',')
      .map((t: string) => t.trim())
      .filter(Boolean);
  }
  return [];
}

function buildFormValues(courseStructure: any): CourseGeneralValues {
  return {
    name: courseStructure?.name || '',
    description: courseStructure?.description || '',
    about: courseStructure?.about || '',
    learnings: initializeLearnings(courseStructure?.learnings || ''),
    tags: parseTags(courseStructure?.tags),
    public: courseStructure?.public ?? false,
    thumbnail_type: courseStructure?.thumbnail_type || 'image',
  };
}

function EditCourseGeneral() {
  const t = useTranslations('CourseEdit.General');
  const tCommon = useTranslations('Common');
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
  const { isLoading, courseStructure } = course;
  const formId = useId();
  const { updateMetadata } = useCoursesMutations(courseStructure?.course_uuid ?? '');

  const serverValues = useMemo(() => buildFormValues(courseStructure), [courseStructure]);

  const form = useForm({
    defaultValues: serverValues,
    validators: {
      onChange: courseGeneralSchema,
      onSubmit: courseGeneralSchema,
    },
    onSubmit: async ({ value }) => {
      setError('');

      await saveWithoutRefresh(
        async () =>
          updateMetadata(value, {
            lastKnownUpdateDate: course.courseStructure.update_date,
          }),
        {
          onSuccess: () => {
            form.reset(value);
            setError('');
          },
        },
      );
    },
  });

  const isDirty = useStore(form.store, (state) => state.isDirty);
  const values = useStore(form.store, (state) => state.values);

  // Keep the global store's dirty map in sync — no separate state needed.
  useSyncDirtySection('general', isDirty);

  const { isSaving, saveWithoutRefresh } = useSaveSection({
    section: 'general',
    errorMessage: t('errors.saveFailed'),
    successMessage: tCommon('saved'),
    onError: setError,
  });

  // Hydrate form from server data on mount / when server data changes.
  useEffect(() => {
    if (!isLoading && courseStructure && !form.state.isDirty) {
      form.reset(serverValues);
    }
  }, [courseStructure, isLoading, serverValues, form]);

  const handleDiscard = () => {
    form.reset(serverValues);
    setError('');
  };

  if (isLoading || !courseStructure) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground bg-muted flex animate-pulse items-center rounded-md border px-4 py-2 text-sm font-medium">
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
      className="space-y-6"
      role="main"
      aria-labelledby="course-edit-title"
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
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
            <SectionHeader
              title={t('title', { courseName: courseStructure.name || '' })}
              description={t('subtitle')}
              isDirty={isDirty}
              isSaving={isSaving}
              onSave={() => {
                void form.handleSubmit();
              }}
              onDiscard={handleDiscard}
            />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-6">
              <form.Field name="name">
                {(field) => (
                  <Field>
                    <FieldLabel
                      className="text-base font-semibold"
                      htmlFor={field.name}
                    >
                      {t('name.label')}
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      placeholder={t('name.placeholder')}
                      className="text-lg"
                      maxLength={100}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>

              <form.Field name="description">
                {(field) => (
                  <Field>
                    <FieldLabel
                      className="text-base font-semibold"
                      htmlFor={field.name}
                    >
                      {t('description.label')}
                    </FieldLabel>
                    <Textarea
                      id={field.name}
                      name={field.name}
                      placeholder={t('description.placeholder')}
                      className="min-h-[100px] resize-y"
                      maxLength={1000}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>

              <form.Field name="about">
                {(field) => (
                  <Field>
                    <FieldLabel
                      className="text-base font-semibold"
                      htmlFor={field.name}
                    >
                      {t('about.label')}
                    </FieldLabel>
                    <Textarea
                      id={field.name}
                      name={field.name}
                      placeholder={t('about.placeholder')}
                      className="min-h-[120px]"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>

              <Separator />

              <form.Field name="learnings">
                {(field) => (
                  <Field>
                    <FieldLabel className="text-base font-semibold">{t('learnings.label')}</FieldLabel>
                    <div
                      role="group"
                      aria-labelledby="learnings-label"
                    >
                      <LearningItemsList
                        value={field.state.value}
                        onChange={field.handleChange}
                        error={field.state.meta.errors?.[0]?.message}
                      />
                    </div>
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>

              <form.Field name="tags">
                {(field) => (
                  <Field>
                    <FieldLabel className="flex items-center gap-2 text-base font-semibold">
                      <Tag
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                      {t('tags.label')}
                    </FieldLabel>
                    <TagsInput
                      placeholder={t('tags.placeholder')}
                      value={field.state.value || []}
                      onValueChange={field.handleChange}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="space-y-1">
              <h2 className="text-foreground text-2xl font-bold tracking-tight">{t('thumbnail.label')}</h2>
              <p className="text-muted-foreground text-sm">{t('thumbnail.mediaUpdatesIsolated')}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="border-border bg-muted/40">
              <ImageIcon className="size-4" />
              <AlertTitle>{t('thumbnail.mediaActionsTitle')}</AlertTitle>
              <AlertDescription>{t('thumbnail.mediaActionsDescription')}</AlertDescription>
            </Alert>

            <form.Field name="thumbnail_type">
              {(field) => (
                <Field>
                  <FieldLabel className="text-base font-semibold">{t('thumbnailType')}</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => {
                      if (value) {
                        field.handleChange(value);
                      }
                    }}
                    items={thumbnailTypeItems}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {thumbnailTypeItems.map((item) => (
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
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>

            <ThumbnailUpdate thumbnailType={values.thumbnail_type} />
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

export default EditCourseGeneral;
