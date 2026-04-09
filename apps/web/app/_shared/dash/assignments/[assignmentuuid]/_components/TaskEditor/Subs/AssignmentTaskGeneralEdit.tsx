'use client';
import { useForm } from '@tanstack/react-form';
import { useAssignmentsTaskStore } from '@components/Contexts/Assignments/AssignmentsTaskContext';
import { AlertCircle, Cloud, Download, File, Info, Loader2, UploadCloud } from 'lucide-react';
import { updateAssignmentTask, updateReferenceFile } from '@services/courses/assignments';
import { useAssignments } from '@components/Contexts/Assignments/AssignmentContext';
import { Field, FieldError, FieldLabel } from '@components/ui/field';
import { useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription } from '@components/ui/alert';
import { getTaskRefFileDir } from '@services/media/media';
import { constructAcceptValue } from '@/lib/constants';
import { DragDropContext } from '@hello-pangea/dnd';
import { Textarea } from '@components/ui/textarea';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { Input } from '@components/ui/input';
import { Badge } from '@components/ui/badge';
import { useTranslations } from 'next-intl';
import Link from '@components/ui/AppLink';
import { toast } from 'sonner';
import * as v from 'valibot';
import { valibotFormValidator } from '@/lib/tanstack-form';

const SUPPORTED_FILES = constructAcceptValue(['pdf', 'docx', 'mp4', 'mkv', 'jpg', 'png', 'pptx', 'zip']);

const createValidationSchema = (t: (key: string) => string) =>
  v.object({
    title: v.pipe(v.string(), v.minLength(1, t('titleRequired'))),
    description: v.optional(v.string()),
    hint: v.optional(v.string()),
    max_grade_value: v.pipe(
      v.number(),
      v.minValue(20, t('gradeValidationError')),
      v.maxValue(100, t('gradeValidationError')),
    ),
  });

type TaskFormData = v.InferOutput<ReturnType<typeof createValidationSchema>>;

export const AssignmentTaskGeneralEdit = () => {
  const t = useTranslations('DashPage.Assignments.TaskGeneralEdit');
  const assignmentTask = useAssignmentsTaskStore((s) => s.assignmentTask);
  const selectedAssignmentTaskUUID = useAssignmentsTaskStore((s) => s.selectedAssignmentTaskUUID);
  const reload = useAssignmentsTaskStore((s) => s.reload);
  const assignment = useAssignments();
  const validationSchema = createValidationSchema(t);
  const formValidator = valibotFormValidator(validationSchema);

  // Check if assignment task data is loaded and task is selected
  const isTaskSelected = selectedAssignmentTaskUUID !== null;
  const isTaskLoaded =
    assignmentTask &&
    Object.keys(assignmentTask).length > 0 &&
    selectedAssignmentTaskUUID === assignmentTask.assignment_task_uuid;

  const form = useForm({
    defaultValues: {
      title: "",
      description: "",
      hint: "",
      max_grade_value: 20,
    },
    validators: {
      onChange: formValidator,
      onSubmit: formValidator,
    },
    onSubmit: async ({ value }) => {
      if (!isTaskLoaded) {
        toast.error(t("taskNotLoaded"));
        return;
      }

      try {
        const assignmentTaskUUID = assignmentTask?.assignment_task_uuid;
        const assignmentUUID = assignment?.assignment_object?.assignment_uuid;

        if (!assignmentTaskUUID || !assignmentUUID) {
          toast.error(t("saveError"));
          return;
        }

        const res = await updateAssignmentTask({
          body: value,
          assignmentTaskUUID,
          assignmentUUID,
        });
        if (res.success) {
          reload();
          toast.success(t("saveSuccess"));
        } else {
          toast.error(t("saveError"));
        }
      } catch (error) {
        console.error("Error updating assignment task:", error);
        toast.error(t("saveError"));
      }
    },
  });

  // Update form values when assignment task changes
  useEffect(() => {
    console.log('Form data update:', {
      isTaskLoaded,
      selectedTaskUUID: selectedAssignmentTaskUUID,
      taskUUID: assignmentTask?.assignment_task_uuid,
      taskData: assignmentTask,
    });

    if (isTaskLoaded) {
      const taskData = assignmentTask;
      form.reset({
        title: taskData.title || '',
        description: taskData.description || '',
        hint: taskData.hint || '',
        max_grade_value: taskData.max_grade_value || 20,
      });
    }
  }, [assignmentTask, form, isTaskLoaded, selectedAssignmentTaskUUID]);

  // Show message if no task is selected
  if (!isTaskSelected) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-gray-600">{t('noTaskSelected')}</p>
        </div>
      </div>
    );
  }

  // Show loading state if task is selected but not loaded yet
  if (isTaskSelected && !isTaskLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-2 text-gray-600">{t('loadingTask')}</p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      className="space-y-6"
    >
      <form.Field name="title">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={field.name}>{t('title')}</FieldLabel>
            <Input
              id={field.name}
              name={field.name}
              type="text"
              placeholder={t('titlePlaceholder')}
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
            <FieldLabel htmlFor={field.name}>{t('description')}</FieldLabel>
            <Textarea
              id={field.name}
              name={field.name}
              placeholder={t('descriptionPlaceholder')}
              className="min-h-[100px]"
              value={field.state.value ?? ''}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>

      <form.Field name="hint">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={field.name}>{t('hint')}</FieldLabel>
            <Textarea
              id={field.name}
              name={field.name}
              placeholder={t('hintPlaceholder')}
              className="min-h-[80px]"
              value={field.state.value ?? ''}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>

      <div className="space-y-2">
        <div className="flex items-center justify-between space-x-3">
          <FieldLabel>{t('referenceFile')}</FieldLabel>
          <div className="flex items-center space-x-1.5 text-xs text-gray-500">
            <Info size={16} />
            <p>{t('allowedFormats')}</p>
          </div>
        </div>
        <UpdateTaskRef />
      </div>

      <form.Field name="max_grade_value">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={field.name}>{t('maxGradeValue')}</FieldLabel>
            <Input
              id={field.name}
              name={field.name}
              type="number"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => {
                field.handleChange(Number(event.target.value));
              }}
            />
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <Button
            type="submit"
            className="mt-4 w-full bg-green-500 px-4 py-2 font-semibold text-white hover:bg-green-600"
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? t('saving') : t('save')}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
};
const UpdateTaskRef = () => {
  const t = useTranslations('DashPage.Assignments.TaskGeneralEdit');
  const assignmentTask = useAssignmentsTaskStore((s) => s.assignmentTask);
  const reload = useAssignmentsTaskStore((s) => s.reload);
  const assignment = useAssignments();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasReferenceFile = Boolean(assignmentTask?.reference_file);
  const fileName = assignmentTask?.reference_file;
  const fileExtension = fileName?.split('.').pop()?.toUpperCase();

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  const ALLOWED_EXT = new Set(['pdf', 'docx', 'mp4', 'mkv', 'jpg', 'png', 'pptx', 'zip']);

  const getTaskRefDirUI = () => {
    if (!fileName) return '';
    const courseUUID = assignment?.course_object?.course_uuid;
    const activityUUID = assignment?.activity_object?.activity_uuid;
    const assignmentUUID = assignment?.assignment_object?.assignment_uuid;
    const assignmentTaskUUID = assignmentTask?.assignment_task_uuid;

    if (!courseUUID || !activityUUID || !assignmentUUID || !assignmentTaskUUID) {
      return '';
    }

    return getTaskRefFileDir({
      courseUUID,
      activityUUID,
      assignmentUUID,
      assignmentTaskUUID,
      fileID: fileName,
    });
  };

  const validateFile = (file: File | null) => {
    if (!file) return 'noFile';
    if (file.size > MAX_FILE_SIZE) return 'fileTooLarge';
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXT.has(ext)) return 'unsupportedFormat';
    return null;
  };
  const handleFileUpload = async (file: File) => {
    if (!assignmentTask || !assignment) {
      setError(t('missingAssignmentInfo'));
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      setError(t(validationError) || validationError);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const assignmentTaskUUID = assignmentTask?.assignment_task_uuid;
      const assignmentUUID = assignment?.assignment_object?.assignment_uuid;

      if (!assignmentTaskUUID || !assignmentUUID) {
        setError(t('missingAssignmentInfo'));
        return;
      }

      const res = await updateReferenceFile({
        file,
        assignmentTaskUUID,
        assignmentUUID,
      });

      if (!res.success) {
        setError(res.data?.detail || t('uploadFailed'));
        return;
      }

      reload();
      toast.success(t('refFileUpdateSuccess'));
    } catch (error) {
      console.error(error);
      setError(t('uploadFailed'));
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void handleFileUpload(file);
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0] ?? null;
    if (file) void handleFileUpload(file);
  };

  return (
    <DragDropContext onDragEnd={() => {}}>
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={[
          'relative rounded-xl border-2 border-dashed transition-colors',
          'bg-background',
          'min-h-[200px]',
          dragActive && 'border-primary bg-primary/5',
          error && 'border-destructive bg-destructive/5',
        ].join(' ')}
      >
        {/* content wrapper */}
        <div className="flex h-full flex-col justify-center gap-4 px-6 py-6 text-center">
          {/* error */}
          {error && (
            <Alert
              variant="destructive"
              className="mx-auto w-full max-w-md"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* loading */}
          {isLoading && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
              <p className="text-muted-foreground text-sm">{t('uploading')}</p>
            </div>
          )}

          {/* uploaded state */}
          {!isLoading && hasReferenceFile && (
            <div className="bg-card mx-auto flex w-full max-w-md flex-col gap-4 rounded-lg border p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <Badge
                  variant="secondary"
                  className="gap-1"
                >
                  <Cloud className="h-3 w-3" />
                  {t('uploaded')}
                </Badge>
                {fileExtension && <Badge variant="outline">{fileExtension}</Badge>}
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-lg p-3">
                  <File className="text-primary h-6 w-6" />
                </div>
                <p className="flex-1 truncate text-sm font-medium">{fileName}</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button>
                  <Link
                    href={getTaskRefDirUI()}
                    download
                    target="_blank"
                    className="flex"
                  >
                    <Download className="mr-1.5 h-4" />
                    {t('download')}
                  </Link>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                >
                  <Label>
                    <UploadCloud className="mr-1.5 h-4 w-4" />
                    {t('replace')}
                    <input
                      type="file"
                      hidden
                      accept={SUPPORTED_FILES}
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                  </Label>
                </Button>
              </div>
            </div>
          )}

          {/* empty state */}
          {!isLoading && !hasReferenceFile && (
            <div className="flex flex-col items-center gap-4">
              <div className="bg-muted rounded-full p-4">
                <UploadCloud className="text-muted-foreground h-7 w-7" />
              </div>

              <div>
                <p className="text-sm font-medium">{t('dragDropFile')}</p>
                <p className="text-muted-foreground mt-1 text-xs">{t('orClickToSelect')}</p>
              </div>

              <Button variant="default">
                <Label>
                  {t('chooseFile')}
                  <input
                    type="file"
                    hidden
                    accept={SUPPORTED_FILES}
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                </Label>
              </Button>

              <p className="text-muted-foreground text-xs">{t('maxFileSize')}</p>
            </div>
          )}
        </div>
      </div>
    </DragDropContext>
  );
};
