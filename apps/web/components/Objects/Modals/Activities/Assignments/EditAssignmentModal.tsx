'use client';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from '@tanstack/react-form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { BarLoader } from '@components/Objects/Loaders/BarLoader';
import { updateAssignment } from '@services/courses/assignments';
import Modal from '@/components/Objects/Elements/Modal/Modal';
import { de, enUS, es, fr, ru } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { getAPIUrl } from '@services/config/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toFieldErrors } from '@/lib/tanstack-form';
import { useRef } from 'react';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { FC } from 'react';
import { toast } from 'sonner';
import * as v from 'valibot';
import { mutate } from 'swr';

interface Assignment {
  assignment_uuid: string;
  title: string;
  description: string;
  due_date?: string;
  grading_type?: 'NUMERIC' | 'PERCENTAGE';
}

interface EditAssignmentFormProps {
  onClose: () => void;
  assignment: Assignment;
}

interface EditAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: Assignment;
}

interface FormValues {
  title: string;
  description: string;
  due_date: string;
  grading_type: 'NUMERIC' | 'PERCENTAGE';
}

const createValidationSchema = (t: (key: string) => string) =>
  v.object({
    title: v.pipe(v.string(), v.minLength(1, t('assignmentTitleRequired'))),
    description: v.pipe(v.string(), v.minLength(1, t('assignmentDescriptionRequired'))),
    due_date: v.string(),
    grading_type: v.picklist(['NUMERIC', 'PERCENTAGE']),
  });

const EditAssignmentForm: FC<EditAssignmentFormProps> = ({ onClose, assignment }) => {
  const validationT = useTranslations('Validation');
  const t = useTranslations('Components.EditAssignmentModal');
  const fullLocale = useLocale();
  const locale = fullLocale.split('-')[0] ?? 'ru';
  const validationSchema = createValidationSchema(validationT);

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
      title: assignment.title || '',
      description: assignment.description || '',
      due_date: assignment.due_date || '',
      grading_type: assignment.grading_type || 'NUMERIC',
    },
    validators: {
      onChange: validationSchema,
      onSubmit: validationSchema,
    },
    onSubmit: async ({ value }) => {
      const toastLoading = toast.loading(t('updateLoading'));
      try {
        const res = await updateAssignment(value, assignment.assignment_uuid);
        if (res.success) {
          mutate(`${getAPIUrl()}assignments/${assignment.assignment_uuid}`);
          toast.success(t('updateSuccess'));
          onClose();
        } else {
          toast.error(t('updateError'));
        }
      } catch {
        toast.error(t('updateErrorGeneric'));
      } finally {
        toast.dismiss(toastLoading);
      }
    },
  });

  const gradingTypes = [
    { value: 'NUMERIC', label: t('numeric') },
    { value: 'PERCENTAGE', label: t('percentage') },
  ];

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      className="space-y-4"
    >
      <form.Field name="title">
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

      <form.Field name="due_date">
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

      <form.Field name="grading_type">
        {(field) => (
          <Field>
            <FieldLabel>{t('gradingType')}</FieldLabel>
            <Select
              onValueChange={(value) => field.handleChange(value as FormValues['grading_type'])}
              value={field.state.value}
              items={gradingTypes}
            >
              <SelectTrigger>
                <SelectValue placeholder={validationT('selectGradingType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {gradingTypes.map((item) => (
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

      <div className="mt-6 flex justify-end space-x-3">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
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
              {isSubmitting ? (
                <BarLoader
                  cssOverride={{ borderRadius: 60 }}
                  width={30}
                  color="#ffffff"
                />
              ) : (
                t('saveChanges')
              )}
            </Button>
          )}
        />
      </div>
    </form>
  );
};

const EditAssignmentModal: FC<EditAssignmentModalProps> = ({ isOpen, onClose, assignment }) => {
  const t = useTranslations('Components.EditAssignmentModal');
  return (
    <Modal
      isDialogOpen={isOpen}
      onOpenChange={onClose}
      minHeight="md"
      minWidth="lg"
      dialogContent={
        <EditAssignmentForm
          onClose={onClose}
          assignment={assignment}
        />
      }
      dialogTitle={t('editAssignment')}
      dialogDescription={t('updateDetails')}
      dialogTrigger={undefined}
    />
  );
};

export default EditAssignmentModal;
