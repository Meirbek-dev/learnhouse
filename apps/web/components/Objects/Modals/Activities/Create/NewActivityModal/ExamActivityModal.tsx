'use client';

import { useForm, useStore } from '@tanstack/react-form';
import { swrFetcher } from '@services/utils/ts/requests';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import * as v from 'valibot';
import useSWR from 'swr';

import { Field, FieldDescription, FieldError, FieldLabel } from '@components/ui/field';
import { getAPIUrl } from '@/services/config/config';
import { Textarea } from '@components/ui/textarea';
import { Switch } from '@components/ui/switch';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { valibotFormValidator } from '@/lib/tanstack-form';

interface ExamLimits {
  time_limit?: { min?: number; max?: number };
}

const createValidationSchema = (t: (key: string) => string, limits?: ExamLimits) =>
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

  const { data: limits } = useSWR(`${getAPIUrl()}exams/config`, swrFetcher);
  const validationSchema = createValidationSchema(validationT, limits);
  const formValidator = valibotFormValidator(validationSchema);
  const withUnpublishedActivities = course ? course.withUnpublishedActivities : false;

  const form = useForm({
    defaultValues: {
      exam_title: "",
      activity_name: "",
      exam_description: "",
      has_time_limit: true,
      time_limit: Math.min(
        Math.max(50, limits?.time_limit?.min ?? 1),
        limits?.time_limit?.max ?? 180,
      ),
      shuffle_questions: true,
      allow_result_review: true,
    },
    validators: {
      onChange: formValidator,
      onSubmit: formValidator,
    },
    onSubmit: async ({ value }) => {
      const toastLoading = toast.loading(t("creatingExam"));
      try {
        const settings = {
          time_limit: value.has_time_limit ? value.time_limit : null,
          attempt_limit: 1,
          shuffle_questions: value.shuffle_questions,
          shuffle_answers: true,
          question_limit: null,
          access_mode: "NO_ACCESS",
          whitelist_user_ids: [],
          allow_result_review: value.allow_result_review,
          show_correct_answers: value.allow_result_review,
          copy_paste_protection: true,
          tab_switch_detection: true,
          devtools_detection: true,
          right_click_disable: true,
          fullscreen_enforcement: true,
          violation_threshold: 3,
        };

        const response = await fetch(`${getAPIUrl()}exams/with-activity`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            activity_name: value.activity_name,
            chapter_id: chapterId,
            exam_title: value.exam_title,
            exam_description: value.exam_description,
            settings,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create exam");
        }

        const data = await response.json();

        toast.dismiss(toastLoading);
        toast.success(t("examCreatedSuccessfully"));

        if (submitActivity) {
          submitActivity();
        }

        if (data.activity_uuid) {
          const activity_uuid_clean = data.activity_uuid.replace(
            "activity_",
            "",
          );

          let courseUuidClean: string | null = null;
          if (course?.course_uuid) {
            courseUuidClean = course.course_uuid.replace("course_", "");
          } else {
            const parts = globalThis.location.pathname
              .split("/")
              .filter(Boolean);
            const courseIndex = parts.indexOf("course");
            if (courseIndex !== -1 && parts.length > courseIndex + 1) {
              courseUuidClean = String(parts[courseIndex + 1]);
            }
          }

          globalThis.location.href = courseUuidClean
            ? `/course/${courseUuidClean}/activity/${activity_uuid_clean}${withUnpublishedActivities ? "?withUnpublishedActivities=true" : ""}`
            : "/courses";
        }

        closeModal();
      } catch (error: any) {
        toast.dismiss(toastLoading);
        toast.error(t("errorCreatingExam"));
        console.error("Error creating exam:", error);
      }
    },
  });
  const hasTimeLimit = useStore(form.store, (state) => state.values.has_time_limit);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      className="space-y-4"
    >
      <form.Field name="activity_name">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={field.name}>{t('activityName')}</FieldLabel>
            <Input
              id={field.name}
              name={field.name}
              placeholder={t('activityNamePlaceholder')}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            <FieldDescription>{t('activityNameDescription')}</FieldDescription>
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>

      <form.Field name="exam_title">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={field.name}>{t('examTitle')}</FieldLabel>
            <Input
              id={field.name}
              name={field.name}
              placeholder={t('examTitlePlaceholder')}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>

      <form.Field name="exam_description">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={field.name}>{t('examDescription')}</FieldLabel>
            <Textarea
              id={field.name}
              name={field.name}
              placeholder={t('examDescriptionPlaceholder')}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>

      <form.Field name="has_time_limit">
        {(field) => (
          <Field className="flex flex-row items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <FieldLabel>{t('enableTimeLimit')}</FieldLabel>
              <FieldDescription>{t('timeLimitDescription')}</FieldDescription>
            </div>
            <Switch
              checked={field.state.value}
              onCheckedChange={(value) => field.handleChange(value)}
            />
          </Field>
        )}
      </form.Field>

      {hasTimeLimit && (
        <form.Field name="time_limit">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>{t('timeLimitMinutes')}</FieldLabel>
              <Input
                id={field.name}
                name={field.name}
                type="number"
                min={limits?.time_limit?.min ?? 1}
                max={limits?.time_limit?.max ?? 180}
                placeholder="60"
                value={field.state.value ?? ''}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  field.handleChange(
                    Number.parseInt(event.target.value, 10) ||
                      Math.min(Math.max(50, limits?.time_limit?.min ?? 1), limits?.time_limit?.max ?? 180),
                  );
                }}
              />
              <FieldDescription>{t('timeLimitMinutesDescription')}</FieldDescription>
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
      )}

      <form.Field name="shuffle_questions">
        {(field) => (
          <Field className="flex flex-row items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <FieldLabel>{t('shuffleQuestions')}</FieldLabel>
              <FieldDescription>{t('shuffleQuestionsDescription')}</FieldDescription>
            </div>
            <Switch
              checked={field.state.value}
              onCheckedChange={(value) => field.handleChange(value)}
            />
          </Field>
        )}
      </form.Field>

      <form.Field name="allow_result_review">
        {(field) => (
          <Field className="flex flex-row items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <FieldLabel>{t('allowResultReview')}</FieldLabel>
              <FieldDescription>{t('allowResultReviewDescription')}</FieldDescription>
            </div>
            <Switch
              checked={field.state.value}
              onCheckedChange={(value) => field.handleChange(value)}
            />
          </Field>
        )}
      </form.Field>

      <div className="mt-6 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={closeModal}
          disabled={form.state.isSubmitting}
        >
          {t('cancel')}
        </Button>
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? t('creating') : t('createExam')}
            </Button>
          )}
        />
      </div>
    </form>
  );
};

export default NewExam;
