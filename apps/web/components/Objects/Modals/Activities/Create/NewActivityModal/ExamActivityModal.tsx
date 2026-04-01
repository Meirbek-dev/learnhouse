'use client';

import { valibotResolver } from '@hookform/resolvers/valibot';
import { swrFetcher } from '@services/utils/ts/requests';
import { Controller, useForm } from 'react-hook-form';
import type { SubmitHandler } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { toast } from 'sonner';
import * as v from 'valibot';
import useSWR from 'swr';

import { Field, FieldDescription, FieldError, FieldLabel } from '@components/ui/field';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { getAPIUrl } from '@/services/config/config';
import { Textarea } from '@components/ui/textarea';
import { Switch } from '@components/ui/switch';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';

const createValidationSchema = (t: (key: string) => string, limits?: any) =>
  v.object({
    exam_title: v.pipe(v.string(), v.minLength(1, t('examTitleRequired'))),
    activity_name: v.pipe(v.string(), v.minLength(1, t('activityNameRequired'))),
    exam_description: v.pipe(v.string(), v.minLength(1, t('examDescriptionRequired'))),
    time_limit: v.optional(
      v.pipe(v.number(), v.minValue(limits?.time_limit?.min ?? 1), v.maxValue(limits?.time_limit?.max ?? 180)),
    ),
    has_time_limit: v.boolean(),
    shuffle_questions: v.boolean(),
    allow_result_review: v.boolean(),
  });

interface FormValues {
  exam_title: string;
  activity_name: string;
  exam_description: string;
  time_limit?: number;
  has_time_limit: boolean;
  shuffle_questions: boolean;
  allow_result_review: boolean;
}

const NewExam = ({ submitActivity, chapterId, course, closeModal }: any) => {
  const validationT = useTranslations('Validation');
  const t = useTranslations('Components.NewExamModal');
  const session = usePlatformSession();

  const { data: limits } = useSWR(`${getAPIUrl()}exams/config`, swrFetcher);
  const validationSchema = createValidationSchema(validationT, limits);
  type ZFormValues = v.InferOutput<typeof validationSchema>;
  const withUnpublishedActivities = course ? course.withUnpublishedActivities : false;

  const form = useForm<ZFormValues, any, ZFormValues>({
    resolver: valibotResolver(validationSchema),
    defaultValues: {
      exam_title: '',
      activity_name: '',
      exam_description: '',
      has_time_limit: true,
      time_limit: Math.min(Math.max(50, limits?.time_limit?.min ?? 1), limits?.time_limit?.max ?? 180),
      shuffle_questions: true,
      allow_result_review: true,
    },
  });

  const [isPending, startTransition] = useTransition();

  const onSubmit: SubmitHandler<ZFormValues> = (values) => {
    const toastLoading = toast.loading(t('creatingExam'));
    startTransition(() => {
      void (async () => {
        try {
          const settings = {
            time_limit: values.has_time_limit ? values.time_limit : null,
            attempt_limit: 1,
            shuffle_questions: values.shuffle_questions,
            shuffle_answers: true,
            question_limit: null,
            access_mode: 'NO_ACCESS',
            whitelist_user_ids: [],
            allow_result_review: values.allow_result_review,
            show_correct_answers: values.allow_result_review,
            copy_paste_protection: true,
            tab_switch_detection: true,
            devtools_detection: true,
            right_click_disable: true,
            fullscreen_enforcement: true,
            violation_threshold: 3,
          };

          const response = await fetch(`${getAPIUrl()}exams/with-activity`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.data?.tokens?.access_token}`,
            },
            body: JSON.stringify({
              activity_name: values.activity_name,
              chapter_id: chapterId,
              exam_title: values.exam_title,
              exam_description: values.exam_description,
              settings,
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to create exam');
          }

          const data = await response.json();

          toast.dismiss(toastLoading);
          toast.success(t('examCreatedSuccessfully'));

          // Reload course data
          if (submitActivity) {
            submitActivity();
          }

          // Navigate to the new activity
          if (data.activity_uuid) {
            const activity_uuid_clean = data.activity_uuid.replace('activity_', '');

            // Prefer the provided course prop, but fall back to parsing the current pathname
            let courseUuidClean: string | null = null;
            if (course?.course_uuid) {
              courseUuidClean = course.course_uuid.replace('course_', '');
            } else {
              const parts = globalThis.location.pathname.split('/').filter(Boolean);
              const courseIndex = parts.indexOf('course');
              if (courseIndex !== -1 && parts.length > courseIndex + 1) {
                courseUuidClean = String(parts[courseIndex + 1]);
              }
            }

            globalThis.location.href = courseUuidClean
              ? `/course/${courseUuidClean}/activity/${activity_uuid_clean}${withUnpublishedActivities ? '?withUnpublishedActivities=true' : ''}`
              : '/courses';
          }

          closeModal();
        } catch (error: any) {
          toast.dismiss(toastLoading);
          toast.error(t('errorCreatingExam'));
          console.error('Error creating exam:', error);
        }
      })();
    });
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-4"
    >
      <Field>
        <FieldLabel htmlFor="activity_name">{t('activityName')}</FieldLabel>
        <Input
          id="activity_name"
          placeholder={t('activityNamePlaceholder')}
          {...form.register('activity_name')}
        />
        <FieldDescription>{t('activityNameDescription')}</FieldDescription>
        <FieldError errors={[form.formState.errors.activity_name]} />
      </Field>

      <Field>
        <FieldLabel htmlFor="exam_title">{t('examTitle')}</FieldLabel>
        <Input
          id="exam_title"
          placeholder={t('examTitlePlaceholder')}
          {...form.register('exam_title')}
        />
        <FieldError errors={[form.formState.errors.exam_title]} />
      </Field>

      <Field>
        <FieldLabel htmlFor="exam_description">{t('examDescription')}</FieldLabel>
        <Textarea
          id="exam_description"
          placeholder={t('examDescriptionPlaceholder')}
          {...form.register('exam_description')}
        />
        <FieldError errors={[form.formState.errors.exam_description]} />
      </Field>

      <Controller
        control={form.control}
        name="has_time_limit"
        render={({ field }) => (
          <Field className="flex flex-row items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <FieldLabel>{t('enableTimeLimit')}</FieldLabel>
              <FieldDescription>{t('timeLimitDescription')}</FieldDescription>
            </div>
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          </Field>
        )}
      />

      {form.watch('has_time_limit') && (
        <Controller
          control={form.control}
          name="time_limit"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={field.name}>{t('timeLimitMinutes')}</FieldLabel>
              <Input
                id={field.name}
                type="number"
                min={limits?.time_limit?.min ?? 1}
                max={limits?.time_limit?.max ?? 180}
                placeholder="60"
                {...field}
                onChange={(e) => {
                  field.onChange(
                    Number.parseInt(e.target.value) ||
                      Math.min(Math.max(50, limits?.time_limit?.min ?? 1), limits?.time_limit?.max ?? 180),
                  );
                }}
              />
              <FieldDescription>{t('timeLimitMinutesDescription')}</FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      )}

      <Controller
        control={form.control}
        name="shuffle_questions"
        render={({ field }) => (
          <Field className="flex flex-row items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <FieldLabel>{t('shuffleQuestions')}</FieldLabel>
              <FieldDescription>{t('shuffleQuestionsDescription')}</FieldDescription>
            </div>
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          </Field>
        )}
      />

      <Controller
        control={form.control}
        name="allow_result_review"
        render={({ field }) => (
          <Field className="flex flex-row items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <FieldLabel>{t('allowResultReview')}</FieldLabel>
              <FieldDescription>{t('allowResultReviewDescription')}</FieldDescription>
            </div>
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          </Field>
        )}
      />

      <div className="mt-6 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={closeModal}
          disabled={isPending}
        >
          {t('cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isPending}
        >
          {isPending ? t('creating') : t('createExam')}
        </Button>
      </div>
    </form>
  );
};

export default NewExam;
