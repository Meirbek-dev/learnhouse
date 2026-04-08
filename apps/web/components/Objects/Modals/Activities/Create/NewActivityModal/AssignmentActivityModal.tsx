'use client';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from '@tanstack/react-form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { createAssignmentWithActivity } from '@services/courses/assignments';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { BarLoader } from '@components/Objects/Loaders/BarLoader';
import { revalidateTags } from '@services/utils/ts/requests';
import { de, enUS, es, fr, ru } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { getAPIUrl } from '@services/config/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toFieldErrors, valibotFormValidator } from '@/lib/tanstack-form';
import { useRef } from 'react';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import * as v from 'valibot';
import { mutate } from 'swr';

const createValidationSchema = (t: (key: string) => string) =>
  v.object({
    name: v.pipe(v.string(), v.minLength(1, t('assignmentTitleRequired'))),
    description: v.pipe(v.string(), v.minLength(1, t('assignmentDescriptionRequired'))),
    dueDate: v.optional(v.string()),
    gradingType: v.picklist(['NUMERIC', 'PERCENTAGE']),
  });

interface FormValues {
  name: string;
  description: string;
  dueDate?: string;
  gradingType: 'NUMERIC' | 'PERCENTAGE';
}

const NewAssignment = ({ submitActivity, chapterId, course, closeModal }: any) => {
  const validationT = useTranslations('Validation');
  const t = useTranslations('Components.NewAssignmentModal');
  const fullLocale = useLocale();
  const locale = fullLocale.split('-')[0] ?? 'ru';
  const validationSchema = createValidationSchema(validationT);
  const formValidator = valibotFormValidator(validationSchema);
  const withUnpublishedActivities = course ? course.withUnpublishedActivities : false;

  const gradingTypeItems = [
    { value: 'NUMERIC', label: t('numeric') },
    { value: 'PERCENTAGE', label: t('percentage') },
  ];

  // Get the appropriate date-fns locale
  const getDateFnsLocale = (locale: string) => {
    const localeMap: Record<string, any> = {
      en: enUS,
      es,
      fr,
      de,
      ru,
    };
    return localeMap[locale] || enUS;
  };

  const dateFnsLocale = getDateFnsLocale(locale);
  const todayRef = useRef(
    (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    })(),
  );
  const today = todayRef.current;

  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
      dueDate: '',
      gradingType: 'NUMERIC',
    },
    validators: {
      onChange: formValidator,
      onSubmit: formValidator,
    },
    onSubmit: async ({ value }) => {
      const toastLoading = toast.loading(t('creatingAssignment'));
      try {
        const res = await createAssignmentWithActivity({
          body: {
            title: value.name,
            description: value.description,
            due_date: value.dueDate,
            grading_type: value.gradingType,
            course_id: course?.courseStructure.id,
            chapter_id: chapterId,
          },
          chapterId,
          activityName: value.name,
        });

        if (res.success) {
          toast.success(t('createSuccess'));

          if (course?.courseStructure?.course_uuid) {
            mutate(
              `${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
            );
          }

          await revalidateTags(['courses']);

          closeModal();
        } else {
          toast.error(t('createError', { error: res.data?.detail || t('unknownError') }));
        }
      } catch (error: any) {
        console.error('Assignment creation failed:', error);
        toast.error(
          t('createError', {
            error: error?.message || t('unexpectedError'),
          }),
        );
      } finally {
        toast.dismiss(toastLoading);
      }
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      className="space-y-4"
    >
      <form.Field name="name">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={field.name}>{t('assignmentTitle')}</FieldLabel>
            <Input
              id={field.name}
              name={field.name}
              type="text"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            <FieldError errors={toFieldErrors(field.state.meta.errors)} />
          </Field>
        )}
      </form.Field>

      <form.Field name="description">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={field.name}>{t('assignmentDescription')}</FieldLabel>
            <Textarea
              id={field.name}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            <FieldError errors={toFieldErrors(field.state.meta.errors)} />
          </Field>
        )}
      </form.Field>

      <form.Field name="dueDate">
        {(field) => (
          <Field>
            <FieldLabel>{t('dueDate')}</FieldLabel>
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !field.state.value && 'text-muted-foreground',
                    )}
                  />
                }
              >
                {field.state.value ? (
                  format(new Date(field.state.value), 'PPP', { locale: dateFnsLocale })
                ) : (
                  <span>{t('selectDeadline')}</span>
                )}
                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0"
                align="start"
              >
                <Calendar
                  mode="single"
                  captionLayout="dropdown"
                  selected={field.state.value ? new Date(field.state.value) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      field.handleChange(`${year}-${month}-${day}`);
                    } else {
                      field.handleChange('');
                    }
                  }}
                  disabled={{ before: today }}
                  locale={dateFnsLocale}
                />
              </PopoverContent>
            </Popover>
            <FieldError errors={toFieldErrors(field.state.meta.errors)} />
          </Field>
        )}
      </form.Field>

      <form.Field name="gradingType">
        {(field) => (
          <Field>
            <FieldLabel>{t('gradingType')}</FieldLabel>
            <Select
              onValueChange={(value) => field.handleChange(value as FormValues['gradingType'])}
              value={field.state.value}
              items={gradingTypeItems}
            >
              <SelectTrigger>
                <SelectValue placeholder={validationT('selectGradingType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {gradingTypeItems.map((item) => (
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
            <FieldError errors={toFieldErrors(field.state.meta.errors)} />
          </Field>
        )}
      </form.Field>

      <div className="mt-6 flex justify-end">
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              className="mt-2.5"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? (
                <BarLoader
                  cssOverride={{ borderRadius: 60 }}
                  width={60}
                  color="#ffffff"
                />
              ) : (
                t('createActivity')
              )}
            </Button>
          )}
        />
      </div>
    </form>
  );
};

export default NewAssignment;
