'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Cloud, File, Info, Loader, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { z } from 'zod';

import { constructAcceptValue } from '@/lib/constants';
import { useAssignments } from '@components/Contexts/Assignments/AssignmentContext';
import {
  useAssignmentsTask,
  useAssignmentsTaskDispatch,
} from '@components/Contexts/Assignments/AssignmentsTaskContext';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import { Button } from '@components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
import { Input } from '@components/ui/input';
import { Textarea } from '@components/ui/textarea';
import { getActivityByID } from '@services/courses/activities';
import { updateAssignmentTask, updateReferenceFile } from '@services/courses/assignments';
import { getTaskRefFileDir } from '@services/media/media';

const SUPPORTED_FILES = constructAcceptValue(['pdf', 'docx', 'mp4', 'mkv', 'jpg', 'png', 'pptx', 'zip']);

const createValidationSchema = (t: (key: string) => string) =>
  z.object({
    title: z.string().min(1, t('titleRequired')),
    description: z.string().min(1, t('descriptionRequired')),
    hint: z.string().optional(),
    max_grade_value: z.coerce.number().min(20, t('gradeValidationError')).max(100, t('gradeValidationError')),
  });

type TaskFormData = z.infer<ReturnType<typeof createValidationSchema>>;

export function AssignmentTaskGeneralEdit() {
  const t = useTranslations('DashPage.Assignments.TaskGeneralEdit');
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const assignmentTaskState = useAssignmentsTask() as any;
  const assignmentTaskStateHook = useAssignmentsTaskDispatch() as any;
  const assignment = useAssignments() as any;
  const validationSchema = createValidationSchema(t);

  const form = useForm<TaskFormData>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      title: assignmentTaskState.assignmentTask.title,
      description: assignmentTaskState.assignmentTask.description,
      hint: assignmentTaskState.assignmentTask.hint,
      max_grade_value: assignmentTaskState.assignmentTask.max_grade_value,
    },
  });

  const handleSubmit = async (values: TaskFormData) => {
    const res = await updateAssignmentTask(
      values,
      assignmentTaskState.assignmentTask.assignment_task_uuid,
      assignment.assignment_object.assignment_uuid,
      access_token,
    );
    if (res) {
      assignmentTaskStateHook({ type: 'reload' });
      toast.success(t('updateSuccess'));
    } else {
      toast.error(t('updateError'));
    }
  };

  // Update form values when assignment task changes
  useEffect(() => {
    form.reset({
      title: assignmentTaskState.assignmentTask.title,
      description: assignmentTaskState.assignmentTask.description,
      hint: assignmentTaskState.assignmentTask.hint,
      max_grade_value: assignmentTaskState.assignmentTask.max_grade_value,
    });
  }, [assignmentTaskState.assignmentTask, form]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-6"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('title')}</FormLabel>
              <FormControl>
                <Input
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
              <FormLabel>{t('description')}</FormLabel>
              <FormControl>
                <Input
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
          name="hint"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('hint')}</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between space-x-3">
            <FormLabel>{t('referenceFile')}</FormLabel>
            <div className="flex items-center space-x-1.5 text-xs text-gray-500">
              <Info size={16} />
              <p>{t('allowedFormats')}</p>
            </div>
          </div>
          <UpdateTaskRef />
        </div>

        <FormField
          control={form.control}
          name="max_grade_value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('maxGradeValue')}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="mt-4 w-full bg-green-500 px-4 py-2 font-semibold text-white hover:bg-green-600"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? t('saving') : t('save')}
        </Button>
      </form>
    </Form>
  );
}

function UpdateTaskRef() {
  const t = useTranslations('DashPage.Assignments.TaskGeneralEdit');
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const access_token = session?.data?.tokens?.access_token;
  const assignmentTaskState = useAssignmentsTask() as any;
  const assignmentTaskStateHook = useAssignmentsTaskDispatch() as any;
  const assignment = useAssignments() as any;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('') as any;
  const [_localRefFile, setLocalRefFile] = useState(null) as any;
  const [_activity, setActivity] = useState('') as any;

  const handleFileChange = async (event: any) => {
    const file = event.target.files[0];
    setLocalRefFile(file);
    setIsLoading(true);
    const res = await updateReferenceFile(
      file,
      assignmentTaskState.assignmentTask.assignment_task_uuid,
      assignment.assignment_object.assignment_uuid,
      access_token,
    );
    assignmentTaskStateHook({ type: 'reload' });
    // wait for 1.5 second to show loading animation
    await new Promise((r) => setTimeout(r, 1500));
    if (res.success === false) {
      setError(res.data.detail);
      setIsLoading(false);
    } else {
      toast.success(t('refFileUpdateSuccess'));
      setIsLoading(false);
      setError('');
    }
  };

  const getTaskRefDirUI = () => {
    return getTaskRefFileDir(
      org?.org_uuid,
      assignment.course_object.course_uuid,
      assignment.activity_object.activity_uuid,
      assignment.assignment_object.assignment_uuid,
      assignmentTaskState.assignmentTask.assignment_task_uuid,
      assignmentTaskState.assignmentTask.reference_file,
    );
  };

  const _deleteReferenceFile = async () => {
    setIsLoading(true);
    const res = await updateReferenceFile(
      '',
      assignmentTaskState.assignmentTask.assignment_task_uuid,
      assignment.assignment_object.assignment_uuid,
      access_token,
    );
    assignmentTaskStateHook({ type: 'reload' });
    // wait for 1.5 second to show loading animation
    await new Promise((r) => setTimeout(r, 1500));
    if (res.success === false) {
      setError(res.data.detail);
      setIsLoading(false);
    } else {
      setIsLoading(false);
      setError('');
    }
  };

  const getActivityUI = useCallback(async () => {
    const res = await getActivityByID(assignment.assignment_object.activity_id, null, access_token);
    setActivity(res.data);
  }, [assignment.assignment_object.activity_id, access_token, setActivity]);

  useEffect(() => {
    getActivityUI();
  }, [getActivityUI]);

  return (
    <div className="h-[200px] w-auto rounded-xl bg-gray-50 shadow-sm outline-gray-200">
      <div className="flex h-full flex-col items-center justify-center">
        <div className="flex flex-col items-center justify-center">
          <div className="flex flex-col items-center justify-center">
            {error && (
              <div className="shadow-xs flex items-center justify-center space-x-2 rounded-md bg-red-200 p-2 text-red-950 transition-all">
                <div className="text-sm font-semibold">{error}</div>
              </div>
            )}
          </div>
          {assignmentTaskState.assignmentTask.reference_file && !isLoading && (
            <div className="soft-shadow relative flex flex-col items-center space-y-1 rounded-lg bg-white px-5 py-3 text-gray-400 shadow-lg">
              <div className="absolute right-0 top-0 flex -translate-y-1/2 translate-x-1/2 transform items-center justify-center rounded-full bg-green-500 px-1.5 py-1.5 text-white">
                <Cloud size={15} />
              </div>
              <File
                size={20}
                className=""
              />
              <div className="text-sm font-semibold uppercase">
                {assignmentTaskState.assignmentTask.reference_file.split('.').pop()}
              </div>
              <div className="mt-2 flex space-x-2">
                <Link
                  href={getTaskRefDirUI()}
                  download
                  target="_blank"
                  className="rounded-full bg-blue-500 px-3 py-1 text-xs font-semibold text-white"
                >
                  {t('download')}
                </Link>
                {/** <button onClick={() => deleteReferenceFile()}
                                    className='bg-red-500 text-white px-3 py-1 rounded-full text-xs font-semibold'>{t('delete')}</button> */}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center">
              <input
                type="file"
                accept={SUPPORTED_FILES}
                id="fileInput"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <div className="text-gray mt-4 flex animate-pulse items-center rounded-md bg-slate-200 px-4 py-2 text-sm font-bold antialiased">
                <Loader
                  size={16}
                  className="mr-2 animate-spin"
                />
                <span>{t('loading')}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <input
                type="file"
                accept={SUPPORTED_FILES}
                id="fileInput"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <button
                className="text-gray mt-6 flex items-center rounded-md px-4 text-sm font-bold antialiased"
                onClick={() => document.getElementById('fileInput')?.click()}
              >
                <UploadCloud
                  size={16}
                  className="mr-2"
                />
                <span>{t('changeRefFile')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
