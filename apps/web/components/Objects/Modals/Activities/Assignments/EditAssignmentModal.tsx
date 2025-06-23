'use client';
import FormLayout, {
  FormField,
  Input,
  Textarea,
  Flex,
  FormLabel,
  FormMessage,
} from '@components/Objects/StyledElements/Form/Form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import { updateAssignment } from '@services/courses/assignments';
import { Calendar } from '@/components/ui/calendar';
import { getAPIUrl } from '@services/config/config';
import * as Form from '@radix-ui/react-form';
import { CalendarIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { useFormik } from 'formik';
import { format } from 'date-fns';
import type { FC } from 'react';
import { mutate } from 'swr';
import { cn } from '@/lib/utils';

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

const EditAssignmentForm: FC<EditAssignmentFormProps> = ({ onClose, assignment, accessToken }) => {
  const t = useTranslations('Components.EditAssignmentModal');

  const formik = useFormik({
    initialValues: {
      title: assignment.title || '',
      description: assignment.description || '',
      due_date: assignment.due_date || '',
      grading_type: assignment.grading_type || 'ALPHABET',
    },
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting }) => {
      const toast_loading = toast.loading(t('updateLoading'));
      try {
        const res = await updateAssignment(values, assignment.assignment_uuid, accessToken);
        if (res.success) {
          mutate(`${getAPIUrl()}assignments/${assignment.assignment_uuid}`);
          toast.success(t('updateSuccess'));
          onClose();
        } else {
          toast.error(t('updateError'));
        }
      } catch (_error) {
        toast.error(t('updateErrorGeneric'));
      } finally {
        toast.dismiss(toast_loading);
        setSubmitting(false);
      }
    },
  });

  return (
    <FormLayout onSubmit={formik.handleSubmit}>
      <FormField name="title">
        <Flex className="items-baseline justify-between">
          <FormLabel>{t('assignmentTitle')}</FormLabel>
          <FormMessage match="valueMissing">{t('valueMissingTitle')}</FormMessage>
        </Flex>
        <Form.Control asChild>
          <Input
            onChange={formik.handleChange}
            value={formik.values.title}
            type="text"
            required
          />
        </Form.Control>
      </FormField>

      <FormField name="description">
        <Flex className="items-baseline justify-between">
          <FormLabel>{t('assignmentDescription')}</FormLabel>
          <FormMessage match="valueMissing">{t('valueMissingDescription')}</FormMessage>
        </Flex>
        <Form.Control asChild>
          <Textarea
            onChange={formik.handleChange}
            value={formik.values.description}
            required
          />
        </Form.Control>
      </FormField>

      <FormField name="due_date">
        <Flex className="items-baseline justify-between">
          <FormLabel>{t('dueDate')}</FormLabel>
          <FormMessage match="valueMissing">{t('valueMissingDueDate')}</FormMessage>
        </Flex>
        <Popover>
          <PopoverTrigger asChild>
            <Form.Control asChild>
              <button
                className={cn(
                  'bg-background focus:ring-ring flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm shadow-sm focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50',
                  !formik.values.due_date && 'text-muted-foreground',
                )}
              >
                {formik.values.due_date ? (
                  format(new Date(formik.values.due_date), 'PPP')
                ) : (
                  <span>{t('selectDeadline')}</span>
                )}
                <CalendarIcon className="ml-2 size-4 opacity-50" />
              </button>
            </Form.Control>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0"
            align="start"
          >
            <Calendar
              mode="single"
              selected={formik.values.due_date ? new Date(formik.values.due_date) : undefined}
              onSelect={(date) => {
                if (date) {
                  // Format date as YYYY-MM-DD without timezone conversion
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  const isoDate = `${year}-${month}-${day}`;
                  formik.setFieldValue('due_date', isoDate);
                } else {
                  formik.setFieldValue('due_date', '');
                }
              }}
              disabled={false}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </FormField>

      <FormField name="grading_type">
        <Flex className="items-baseline justify-between">
          <FormLabel>{t('gradingType')}</FormLabel>
          <FormMessage match="valueMissing">{t('valueMissingGradingType')}</FormMessage>
        </Flex>
        <select
          id="grading_type"
          name="grading_type"
          className="w-full rounded-lg bg-gray-100/40 px-3 py-2 outline-gray-100"
          onChange={(e) => formik.setFieldValue('grading_type', e.target.value, true)}
          value={formik.values.grading_type}
          required
        >
          <option value="ALPHABET">{t('alphabet')}</option>
          <option value="NUMERIC">{t('numeric')}</option>
          <option value="PERCENTAGE">{t('percentage')}</option>
        </select>
      </FormField>

      <div className="mt-6 flex justify-end space-x-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-4 py-2 text-gray-600 hover:bg-gray-100"
        >
          {t('cancel')}
        </button>
        <Form.Submit asChild>
          <button
            type="submit"
            disabled={formik.isSubmitting}
            className="rounded-md bg-black px-4 py-2 font-bold text-white hover:bg-black/90"
          >
            {formik.isSubmitting ? t('saving') : t('saveChanges')}
          </button>
        </Form.Submit>
      </div>
    </FormLayout>
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
