'use client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import { BarLoader } from '@components/Objects/Loaders/BarLoader';
import { updateAssignment } from '@services/courses/assignments';
import { de, enUS, es, fr, ru } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { zodResolver } from '@hookform/resolvers/zod';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { getAPIUrl } from '@services/config/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { FC } from 'react';
import { mutate } from 'swr';
import { z } from 'zod';

interface Assignment {
  assignment_uuid: string;
  title: string;
  description: string;
  due_date?: string;
  grading_type?: 'ALPHABET' | 'NUMERIC' | 'PERCENTAGE';
}

interface EditAssignmentFormProps {
  onClose: () => void;
  assignment: Assignment;
  accessToken: string;
}

interface EditAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: Assignment;
  accessToken: string;
}

interface FormValues {
  title: string;
  description: string;
  due_date: string;
  grading_type: 'ALPHABET' | 'NUMERIC' | 'PERCENTAGE';
}

const createValidationSchema = (t: (key: string) => string) =>
  z.object({
    title: z.string().min(1, t('assignmentTitleRequired')),
    description: z.string().min(1, t('assignmentDescriptionRequired')),
    due_date: z.string(),
    grading_type: z.enum(['ALPHABET', 'NUMERIC', 'PERCENTAGE']),
  });

const EditAssignmentForm: FC<EditAssignmentFormProps> = ({ onClose, assignment, accessToken }) => {
  const validationT = useTranslations('Validation');
  const t = useTranslations('Components.EditAssignmentModal');
  const fullLocale = useLocale();
  const locale = fullLocale.split('-')[0] ?? 'ru';
  const validationSchema = createValidationSchema(validationT);

  // Get the appropriate date-fns locale
  const getDateFnsLocale = (locale: string) => {
    const localeMap: Record<string, any> = {
      en: enUS,
      es: es,
      fr: fr,
      de: de,
      ru: ru,
    };
    return localeMap[locale] || enUS;
  };

  const dateFnsLocale = getDateFnsLocale(locale);

  const form = useForm<FormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      title: assignment.title || '',
      description: assignment.description || '',
      due_date: assignment.due_date || '',
      grading_type: assignment.grading_type || 'ALPHABET',
    },
  });

  const onSubmit = async (values: FormValues) => {
    const toastLoading = toast.loading(t('updateLoading'));
    try {
      const res = await updateAssignment(values, assignment.assignment_uuid, accessToken);
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
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('assignmentTitle')}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
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
              <FormLabel>{t('assignmentDescription')}</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="due_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('dueDate')}</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !field.value && 'text-muted-foreground',
                      )}
                    >
                      {field.value ? (
                        format(new Date(field.value), 'PPP', { locale: dateFnsLocale })
                      ) : (
                        <span>{t('selectDeadline')}</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0"
                  align="start"
                >
                  <Calendar
                    mode="single"
                    captionLayout="dropdown"
                    selected={field.value ? new Date(field.value) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const isoDate = `${year}-${month}-${day}`;
                        field.onChange(isoDate);
                      } else {
                        field.onChange('');
                      }
                    }}
                    disabled={false}
                    locale={dateFnsLocale}
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="grading_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('gradingType')}</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectGradingType')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="ALPHABET">{t('alphabet')}</SelectItem>
                  <SelectItem value="NUMERIC">{t('numeric')}</SelectItem>
                  <SelectItem value="PERCENTAGE">{t('percentage')}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="mt-6 flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            {t('cancel')}
          </Button>
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? (
              <BarLoader
                cssOverride={{ borderRadius: 60 }}
                width={30}
                color="#ffffff"
              />
            ) : (
              t('saveChanges')
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

const EditAssignmentModal: FC<EditAssignmentModalProps> = ({ isOpen, onClose, assignment, accessToken }) => {
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
          accessToken={accessToken}
        />
      }
      dialogTitle={t('editAssignment')}
      dialogDescription={t('updateDetails')}
      dialogTrigger={null}
    />
  );
};

export default EditAssignmentModal;
