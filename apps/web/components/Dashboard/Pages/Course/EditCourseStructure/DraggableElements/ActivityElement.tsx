import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  AlertTriangle,
  Backpack,
  Check,
  ClipboardList,
  Code2,
  Eye,
  File,
  FilePenLine,
  Globe,
  GripVertical,
  Loader2,
  Lock,
  Pencil,
  Sparkles,
  Trash2,
  Video,
  X as XIcon,
} from 'lucide-react';
import { deleteAssignmentUsingActivityUUID, getAssignmentFromActivityUUID } from '@services/courses/assignments';
import { CourseWorkflowBadge } from '@components/Dashboard/Courses/courseWorkflowUi';
import { useActivityMutations } from '@/hooks/mutations/useActivityMutations';
import { cleanActivityUuid, cleanCourseUuid } from '@/lib/course-management';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import ToolTip from '@/components/Objects/Elements/Tooltip/Tooltip';
import { useCourse } from '@components/Contexts/CourseContext';
import { getAbsoluteUrl } from '@services/config/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Draggable } from '@hello-pangea/dnd';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';
import useSWR from 'swr';

type ActivityType =
  | 'TYPE_VIDEO'
  | 'TYPE_DOCUMENT'
  | 'TYPE_ASSIGNMENT'
  | 'TYPE_DYNAMIC'
  | 'TYPE_EXAM'
  | 'TYPE_CODE_CHALLENGE';

interface Activity {
  id: string;
  activity_uuid: string;
  activity_type: ActivityType;
  name: string;
  published: boolean;
  can_update?: boolean;
  can_delete?: boolean;
  is_owner?: boolean;
  is_creator?: boolean;
  available_actions?: string[];
}

interface ActivityElementProps {
  activity: Activity;
  activityIndex: number;
  course_uuid: string;
}

interface PlatformSession {
  data?: { tokens?: { access_token?: string } };
}

interface Course {
  courseStructure?: { course_uuid?: string };
}

const ACTIVITY_CONFIG = {
  TYPE_VIDEO: {
    Icon: Video,
    translationKey: 'video',
    colorClass: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300',
  },
  TYPE_DOCUMENT: {
    Icon: File,
    translationKey: 'document',
    colorClass:
      'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300',
  },
  TYPE_ASSIGNMENT: {
    Icon: Backpack,
    translationKey: 'assignment',
    colorClass:
      'border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300',
  },
  TYPE_DYNAMIC: {
    Icon: Sparkles,
    translationKey: 'dynamic',
    colorClass:
      'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300',
  },
  TYPE_EXAM: {
    Icon: ClipboardList,
    translationKey: 'exam',
    colorClass: 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300',
  },
  TYPE_CODE_CHALLENGE: {
    Icon: Code2,
    translationKey: 'codeChallenge',
    colorClass: 'border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300',
  },
} as const;

const ActivityElement = ({ activity, activityIndex, course_uuid }: ActivityElementProps) => {
  const session = usePlatformSession() as PlatformSession;
  const access_token = session?.data?.tokens?.access_token;
  const { deleteActivity, updateActivity } = useActivityMutations(course_uuid, true);
  const t = useTranslations('CourseEdit.ActivityElement');

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(activity?.name ?? '');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isUpdatingPublish, setIsUpdatingPublish] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingActivity, setIsDeletingActivity] = useState(false);
  const [fetchAssignment, setFetchAssignment] = useState(false);

  const { data: assignmentUUID, isLoading: isAssignmentLoading } = useSWR(
    activity.activity_type === 'TYPE_ASSIGNMENT' && access_token && fetchAssignment
      ? [`assignment-${activity.activity_uuid}`, access_token]
      : null,
    async () => {
      if (!access_token) {
        return null;
      }
      const result = await getAssignmentFromActivityUUID(activity.activity_uuid, access_token);
      return result?.data?.assignment_uuid?.replace('assignment_', '') ?? null;
    },
  );

  const canUpdate = activity.can_update ?? false;
  const canDelete = activity.can_delete ?? false;
  const isOwner = activity.is_owner ?? false;

  const handleStartEdit = () => {
    setEditedName(activity.name);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedName(activity.name);
  };

  const handleSaveEdit = async () => {
    if (!access_token) {
      toast.error(t('noAccessToken'));
      return;
    }
    const trimmedName = editedName.trim();
    if (!trimmedName || trimmedName === activity.name) {
      handleCancelEdit();
      return;
    }
    setIsSavingEdit(true);
    try {
      await updateActivity(activity.activity_uuid, { name: trimmedName }, access_token);
      toast.success(t('activityNameUpdatedSuccess'));
      setIsEditing(false);
    } catch (error: any) {
      toast.error(error?.message || t('failedToUpdateActivityName'));
      setEditedName(activity.name);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!access_token) {
      toast.error(t('noAccessToken'));
      return;
    }
    setIsUpdatingPublish(true);
    const toastId = toast.loading(t('updating'));
    try {
      await updateActivity(activity.activity_uuid, { published: !activity.published }, access_token);
      toast.success(t('activityUpdateSuccess'));
    } catch (error: any) {
      toast.error(error?.message || t('updateFailed'));
    } finally {
      toast.dismiss(toastId);
      setIsUpdatingPublish(false);
    }
  };

  const handleDeleteActivity = async () => {
    if (!access_token) {
      toast.error(t('noAccessToken'));
      return;
    }
    setIsDeletingActivity(true);
    const toastId = toast.loading(t('deletingActivity'));
    try {
      if (activity.activity_type === 'TYPE_ASSIGNMENT') {
        try {
          await deleteAssignmentUsingActivityUUID(activity.activity_uuid, access_token);
        } catch {
          /* continue */
        }
      }
      await deleteActivity(activity.activity_uuid, access_token);
      toast.success(t('activityDeletedSuccess'));
      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      toast.error(error?.message || t('deleteFailed'));
    } finally {
      toast.dismiss(toastId);
      setIsDeletingActivity(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  if (!activity?.activity_uuid) return null;

  return (
    <Draggable
      draggableId={activity.activity_uuid}
      index={activityIndex}
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            'mb-2 flex items-center gap-3 rounded-lg border bg-card p-3 transition-all duration-200',
            snapshot.isDragging ? 'shadow-xl ring-2 ring-ring/30' : 'shadow-sm hover:shadow-md',
          )}
        >
          {/* Drag Handle */}
          <div
            {...provided.dragHandleProps}
            className="flex-shrink-0 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="h-5 w-5" />
          </div>

          {/* Type Badge */}
          <ActivityTypeBadge activityType={activity.activity_type} />

          {/* Name */}
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <div className="flex items-center gap-1.5">
                <Input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('activityNamePlaceholder')}
                  className="h-8 text-sm"
                  disabled={isSavingEdit}
                />
                <ToolTip
                  content={t('save')}
                  side="top"
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 flex-shrink-0 p-0 text-emerald-600 hover:text-emerald-700"
                    onClick={() => void handleSaveEdit()}
                    disabled={isSavingEdit}
                  >
                    {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                </ToolTip>
                <ToolTip
                  content={t('cancel')}
                  side="top"
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 flex-shrink-0 p-0"
                    onClick={handleCancelEdit}
                    disabled={isSavingEdit}
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                </ToolTip>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">{activity.name}</span>
                {activity.published ? (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                    {t('liveBadge')}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                    {t('draftBadge')}
                  </span>
                )}
                {isOwner && (
                  <ToolTip content={t('ownerBadge')}>
                    <CourseWorkflowBadge tone="info">{t('ownerLabel')}</CourseWorkflowBadge>
                  </ToolTip>
                )}
                {canUpdate && (
                  <ToolTip
                    content={t('editButton')}
                    side="top"
                  >
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 flex-shrink-0 p-0 text-muted-foreground hover:text-foreground"
                      onClick={handleStartEdit}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </ToolTip>
                )}
              </div>
            )}
          </div>

          {/* Action icons */}
          {!isEditing && (
            <div className="flex flex-shrink-0 items-center gap-1">
              {/* Open content editor */}
              <ActivityEditButton
                activity={activity}
                course_uuid={course_uuid}
                assignmentUUID={assignmentUUID ?? null}
                isAssignmentLoading={isAssignmentLoading}
                onRequestAssignment={() => setFetchAssignment(true)}
              />

              {/* Preview */}
              <ToolTip
                content={t('previewTooltip')}
                side="top"
              >
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    window.open(
                      `${getAbsoluteUrl('')}/course/${cleanCourseUuid(course_uuid)}/activity/${cleanActivityUuid(activity.activity_uuid)}`,
                      '_blank',
                      'noopener,noreferrer',
                    )
                  }
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </ToolTip>

              {/* Publish toggle */}
              {canUpdate && (
                <ToolTip
                  content={activity.published ? t('unpublish') : t('publish')}
                  side="top"
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    onClick={handleTogglePublish}
                    disabled={isUpdatingPublish}
                  >
                    {isUpdatingPublish ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : activity.published ? (
                      <Lock className="h-4 w-4" />
                    ) : (
                      <Globe className="h-4 w-4" />
                    )}
                  </Button>
                </ToolTip>
              )}

              {/* Delete */}
              {canDelete && (
                <ToolTip
                  content={t('deleteButton')}
                  side="top"
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </ToolTip>
              )}
            </div>
          )}

          <AlertDialog
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-muted text-foreground">
                  <AlertTriangle className="size-8" />
                </AlertDialogMedia>
                <AlertDialogTitle>{t('deleteTitle', { name: activity.name })}</AlertDialogTitle>
                <AlertDialogDescription>{t('deleteConfirmation')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeletingActivity} />
                <AlertDialogAction
                  variant="destructive"
                  onClick={handleDeleteActivity}
                  disabled={isDeletingActivity}
                >
                  {isDeletingActivity ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('deleting')}
                    </>
                  ) : (
                    t('deleteButton')
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </Draggable>
  );
};

const ActivityTypeBadge = ({ activityType }: { activityType: ActivityType }) => {
  const t = useTranslations('CourseEdit.ActivityElement');
  const config = ACTIVITY_CONFIG[activityType];
  if (!config) return null;
  const { Icon, translationKey, colorClass } = config;
  return (
    <div className={cn('flex flex-shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1', colorClass)}>
      <Icon className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">{t(`ActivityTypes.${translationKey}`)}</span>
    </div>
  );
};

const ActivityEditButton = ({
  activity,
  course_uuid,
  assignmentUUID,
  isAssignmentLoading,
  onRequestAssignment,
}: {
  activity: Activity;
  course_uuid: string;
  assignmentUUID: string | null;
  isAssignmentLoading: boolean;
  onRequestAssignment: () => void;
}) => {
  const t = useTranslations('CourseEdit.ActivityElement');
  const course = useCourse() as Course;

  if (activity.activity_type === 'TYPE_DYNAMIC') {
    const editUrl = `${getAbsoluteUrl('')}/course/${cleanCourseUuid(course?.courseStructure?.course_uuid ?? course_uuid)}/activity/${cleanActivityUuid(activity.activity_uuid)}/edit`;
    return (
      <ToolTip
        content={t('editPageButton')}
        side="top"
      >
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          nativeButton={false}
          render={
            <a
              href={editUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="sr-only">{t('openEditPage')}</span>
            </a>
          }
        >
          <FilePenLine className="h-4 w-4" />
        </Button>
      </ToolTip>
    );
  }

  if (activity.activity_type === 'TYPE_ASSIGNMENT') {
    if (isAssignmentLoading) {
      return (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          disabled
        >
          <Loader2 className="h-4 w-4 animate-spin" />
        </Button>
      );
    }
    if (!assignmentUUID) {
      return (
        <ToolTip
          content={t('editAssignmentButton')}
          side="top"
        >
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            onMouseEnter={onRequestAssignment}
            onClick={onRequestAssignment}
          >
            <FilePenLine className="h-4 w-4" />
          </Button>
        </ToolTip>
      );
    }
    const editUrl = `${getAbsoluteUrl('')}/dash/assignments/${assignmentUUID}`;
    return (
      <ToolTip
        content={t('editAssignmentButton')}
        side="top"
      >
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          nativeButton={false}
          render={
            <a
              href={editUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="sr-only">{t('openEditPage')}</span>
            </a>
          }
        >
          <FilePenLine className="h-4 w-4" />
        </Button>
      </ToolTip>
    );
  }

  if (activity.activity_type === 'TYPE_CODE_CHALLENGE') {
    const editUrl = `${getAbsoluteUrl('')}/course/${cleanCourseUuid(course?.courseStructure?.course_uuid ?? course_uuid)}/activity/${cleanActivityUuid(activity.activity_uuid)}/editor`;
    return (
      <ToolTip
        content={t('configureButton')}
        side="top"
      >
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          nativeButton={false}
          render={
            <a
              href={editUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="sr-only">{t('openEditPage')}</span>
            </a>
          }
        >
          <FilePenLine className="h-4 w-4" />
        </Button>
      </ToolTip>
    );
  }

  return null;
};

export default ActivityElement;
