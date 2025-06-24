'use client';
import * as Form from '@radix-ui/react-form';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { BarLoader } from 'react-spinners';
import { mutate } from 'swr';

import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import FormLayout, {
  ButtonBlack,
  Flex,
  FormField,
  FormLabel,
  FormMessage,
  Input,
} from '@components/Objects/StyledElements/Form/Form';
import { getAPIUrl } from '@services/config/config';
import { createActivity, deleteActivity } from '@services/courses/activities';
import { createAssignment } from '@services/courses/assignments';

function NewAssignment({ submitActivity, chapterId, course, closeModal }: any) {
  const t = useTranslations('Components.NewAssignmentModal');
  const org = useOrg() as any;
  const session = useLHSession() as any;
  const [activityName, setActivityName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activityDescription, setActivityDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [gradingType, setGradingType] = useState('PERCENTAGE');

  const handleNameChange = (e: any) => {
    setActivityName(e.target.value);
  };

  const handleDescriptionChange = (e: any) => {
    setActivityDescription(e.target.value);
  };

  const handleDueDateChange = (date: any) => {
    if (date) {
      // Format date as YYYY-MM-DD without timezone conversion
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const isoDate = `${year}-${month}-${day}`;
      setDueDate(isoDate);
    } else {
      setDueDate('');
    }
  };

  const handleGradingTypeChange = (e: any) => {
    setGradingType(e.target.value);
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setIsSubmitting(true);
    const toast_loading = toast.loading(t('creatingAssignment'));

    let activity_res: any;
    try {
      activity_res = await createActivity(
        {
          name: activityName,
          chapter_id: chapterId,
          activity_type: 'TYPE_ASSIGNMENT',
          activity_sub_type: 'SUBTYPE_ASSIGNMENT_ANY',
          published: false,
          course_id: course?.courseStructure.id,
        },
        chapterId,
        org?.id,
        session.data?.tokens?.access_token,
      );

      const res = await createAssignment(
        {
          title: activityName,
          description: activityDescription,
          due_date: dueDate,
          grading_type: gradingType,
          course_id: course?.courseStructure.id,
          org_id: org?.id,
          chapter_id: chapterId,
          activity_id: activity_res?.id,
        },
        session.data?.tokens?.access_token,
      );

      if (res.success) {
        toast.success(t('createSuccess'));
        mutate(`${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta`);
        closeModal();
      } else {
        toast.error(t('createError', { error: res.data?.detail || t('unknownError') }));
        if (activity_res?.activity_uuid) {
          await deleteActivity(activity_res.activity_uuid, session.data?.tokens?.access_token);
        }
      }
    } catch (error: any) {
      toast.error(
        t('createError', {
          error: error?.message || t('unexpectedError'),
        }),
      );
      if (activity_res?.activity_uuid) {
        try {
          await deleteActivity(activity_res.activity_uuid, session.data?.tokens?.access_token);
        } catch (error) {
          console.error('Failed to rollback activity creation:', error);
        }
      }
    } finally {
      toast.dismiss(toast_loading);
      setIsSubmitting(false);
    }
  };

  return (
    <FormLayout onSubmit={handleSubmit}>
      <FormField name="assignment-activity-title">
        <Flex className="items-baseline justify-between">
          <FormLabel>{t('assignmentTitle')}</FormLabel>
          <FormMessage match="valueMissing">{t('valueMissingTitle')}</FormMessage>
        </Flex>
        <Form.Control asChild>
          <Input
            onChange={handleNameChange}
            type="text"
            required
          />
        </Form.Control>
      </FormField>

      {/* Description  */}
      <FormField name="assignment-activity-description">
        <Flex className="items-baseline justify-between">
          <FormLabel>{t('assignmentDescription')}</FormLabel>
          <FormMessage match="valueMissing">{t('valueMissingDescription')}</FormMessage>
        </Flex>
        <Form.Control asChild>
          <Input
            onChange={handleDescriptionChange}
            type="text"
            required
          />
        </Form.Control>
      </FormField>

      {/* Due date  */}
      <FormField name="assignment-activity-due-date">
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
                  !dueDate && 'text-muted-foreground',
                )}
              >
                {dueDate ? format(new Date(dueDate), 'PPP') : <span>{t('selectDeadline')}</span>}
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
              selected={dueDate ? new Date(dueDate) : undefined}
              onSelect={handleDueDateChange}
              disabled={false}
            />
          </PopoverContent>
        </Popover>
      </FormField>

      {/* Grading type  */}
      <FormField name="assignment-activity-grading-type">
        <Flex className="items-baseline justify-between">
          <FormLabel>{t('gradingType')}</FormLabel>
          <FormMessage match="valueMissing">{t('valueMissingGradingType')}</FormMessage>
        </Flex>
        <Form.Control asChild>
          <select
            className="rounded-lg bg-gray-100/40 px-1 py-2 outline-gray-100"
            onChange={handleGradingTypeChange}
            required
          >
            <option value="ALPHABET">{t('alphabet')}</option>
            <option value="NUMERIC">{t('numeric')}</option>
            <option value="PERCENTAGE">{t('percentage')}</option>
          </select>
        </Form.Control>
      </FormField>

      <Flex className="mt-6 justify-end">
        <Form.Submit asChild>
          <ButtonBlack
            type="submit"
            className="mt-2.5"
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
          </ButtonBlack>
        </Form.Submit>
      </Flex>
    </FormLayout>
  );
}

export default NewAssignment;
