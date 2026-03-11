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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  AlertTriangle,
  Backpack,
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
  Save,
  Sparkles,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { CourseWorkflowBadge } from '@components/Dashboard/Courses/courseWorkflowUi';
import { deleteAssignmentUsingActivityUUID, getAssignmentFromActivityUUID } from '@services/courses/assignments';
import { deleteActivity, updateActivity } from '@services/courses/activities';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { PermissionTooltip } from '@/components/Utils/PermissionTooltip';
import ToolTip from '@/components/Objects/Elements/Tooltip/Tooltip';
import { getAPIUrl, getUriWithOrg } from '@services/config/config';
import { useCourse } from '@components/Contexts/CourseContext';
import { useOrg } from '@components/Contexts/OrgContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Draggable } from '@hello-pangea/dnd';
import { useTranslations } from 'next-intl';
import Link from '@components/ui/AppLink';
import { toast } from 'sonner';
import { mutate } from 'swr';
import useSWR from 'swr';

// Types
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
  orgslug: string;
  activity: Activity;
  activityIndex: number;
  course_uuid: string;
}

interface PlatformSession {
  data?: {
    tokens?: {
      access_token?: string;
    };
  };
}

interface Course {
  courseStructure?: {
    course_uuid: string;
  };
  withUnpublishedActivities?: boolean;
}

interface Organization {
  slug: string;
}

// Activity type configuration
const ACTIVITY_CONFIG = {
  TYPE_VIDEO: {
    Icon: Video,
    translationKey: 'video',
    colorClass: 'border-border bg-muted/60 text-foreground',
  },
  TYPE_DOCUMENT: {
    Icon: File,
    translationKey: 'document',
    colorClass: 'border-border bg-muted/40 text-foreground',
  },
  TYPE_ASSIGNMENT: {
    Icon: Backpack,
    translationKey: 'assignment',
    colorClass: 'border-border bg-muted/70 text-foreground',
  },
  TYPE_DYNAMIC: {
    Icon: Sparkles,
    translationKey: 'dynamic',
    colorClass: 'border-border bg-muted/70 text-foreground',
  },
  TYPE_EXAM: {
    Icon: ClipboardList,
    translationKey: 'exam',
    colorClass: 'border-border bg-muted/70 text-muted-foreground',
  },
  TYPE_CODE_CHALLENGE: {
    Icon: Code2,
    translationKey: 'codeChallenge',
    colorClass: 'border-border bg-muted/70 text-foreground',
  },
} as const;

const ActivityElement = ({ orgslug, activity, activityIndex, course_uuid }: ActivityElementProps) => {
  // Hooks
  const session = usePlatformSession() as PlatformSession;
  const access_token = session?.data?.tokens?.access_token;
  const course = useCourse() as Course;
  const isMobile = useIsMobile();
  const t = useTranslations('CourseEdit.ActivityElement');
  const [isPending, startTransition] = useTransition();

  // State
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(activity?.name ?? '');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isUpdatingPublish, setIsUpdatingPublish] = useState(false);

  // Permission checks from backend metadata
  const canUpdate = activity.can_update ?? false;
  const canDelete = activity.can_delete ?? false;
  const isOwner = activity.is_owner ?? false;
  const availableActions = activity.available_actions ?? [];

  // Derived values
  const withUnpublishedActivities = course?.withUnpublishedActivities ?? false;
  const courseMetaUrl = `${getAPIUrl()}courses/${course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`;

  // Handlers
  const handleStartEdit = () => {
    setIsEditing(true);
    setEditedName(activity.name);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedName(activity.name);
  };

  const handleSaveEdit = async () => {
    if (!access_token) {
      toast.error(t('noAccessToken', { default: 'Authentication required' }));
      return;
    }

    const trimmedName = editedName.trim();
    if (!trimmedName || trimmedName === activity.name) {
      handleCancelEdit();
      return;
    }

    startTransition(async () => {
      try {
        await updateActivity({ ...activity, name: trimmedName }, activity.activity_uuid, access_token, {
          courseUuid: course_uuid,
        });
        await mutate(courseMetaUrl);
        toast.success(t('activityNameUpdatedSuccess'));
        setIsEditing(false);
      } catch (error) {
        console.error('Failed to update activity name:', error);
        toast.error(t('failedToUpdateActivityName'));
        setEditedName(activity.name);
      }
    });
  };

  const handleTogglePublish = async () => {
    if (!access_token) {
      toast.error(t('noAccessToken', { default: 'Authentication required' }));
      return;
    }

    setIsUpdatingPublish(true);
    const toastId = toast.loading(t('updating'));

    try {
      await updateActivity({ ...activity, published: !activity.published }, activity.activity_uuid, access_token, {
        courseUuid: course_uuid,
      });
      await mutate(courseMetaUrl);
      toast.success(t('activityUpdateSuccess'));
    } catch (error) {
      console.error('Failed to toggle publish status:', error);
      toast.error(t('updateFailed', { default: 'Failed to update activity' }));
    } finally {
      toast.dismiss(toastId);
      setIsUpdatingPublish(false);
    }
  };

  const handleDeleteActivity = async () => {
    if (!access_token) {
      toast.error(t('noAccessToken', { default: 'Authentication required' }));
      return;
    }

    startTransition(async () => {
      const toastId = toast.loading(t('deletingActivity'));

      try {
        // Delete assignment if it's an assignment activity
        if (activity.activity_type === 'TYPE_ASSIGNMENT') {
          await deleteAssignmentUsingActivityUUID(activity.activity_uuid, access_token);
        }

        await deleteActivity(activity.activity_uuid, access_token, { courseUuid: course_uuid });
        await mutate(courseMetaUrl);
        toast.success(t('activityDeletedSuccess'));
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error('Failed to delete activity:', error);
        toast.error(t('deleteFailed', { default: 'Failed to delete activity' }));
      } finally {
        toast.dismiss(toastId);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  // Early validation (moved below hooks to satisfy Rules of Hooks)
  if (!activity?.activity_uuid) {
    console.error('ActivityElement: Invalid activity data', activity);
    return null;
  }

  return (
    <Draggable
      draggableId={activity.activity_uuid}
      index={activityIndex}
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`
            mb-2 flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3
            transition-all duration-200
            ${
              snapshot.isDragging
                ? 'scale-[1.02] rotate-1 shadow-xl ring-2 ring-ring/30'
                : 'shadow-sm hover:shadow-md'
            }
          `}
        >
          {/* Drag Handle */}
          <div
            {...provided.dragHandleProps}
            className="cursor-grab text-neutral-400 hover:text-neutral-600 active:cursor-grabbing"
          >
            <GripVertical className="h-5 w-5" />
          </div>

          {/* Activity Type Badge */}
          <ActivityTypeBadge activityType={activity.activity_type} />

          {/* Activity Name (Editable) */}
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('activityNamePlaceholder')}
                  className="h-8 text-sm"
                  disabled={isPending}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSaveEdit}
                  disabled={isPending || !editedName.trim()}
                  className="h-8 w-8 p-0 hover:bg-muted"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelEdit}
                  disabled={isPending}
                  className="h-8 w-8 p-0 hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="group flex items-center gap-2">
                <p className="truncate text-sm font-medium text-neutral-900">{activity.name}</p>
                {canUpdate && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleStartEdit}
                    className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
                {isOwner && (
                  <ToolTip content={t('ownerBadge', { default: 'You created this activity' })}>
                    <CourseWorkflowBadge tone="info">{t('ownerLabel')}</CourseWorkflowBadge>
                  </ToolTip>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-shrink-0 items-center gap-2">
            {/* Edit Button (for assignments and dynamic pages) */}
            <ActivityEditButton
              activity={activity}
              orgslug={orgslug}
              course_uuid={course_uuid}
            />

            {/* Publish/Unpublish Toggle */}
            <PermissionTooltip
              enabled={canUpdate}
              action="update"
            >
              <Button
                size="sm"
                variant={activity.published ? 'outline' : 'default'}
                onClick={handleTogglePublish}
                disabled={isUpdatingPublish || !canUpdate}
                className={
                  activity.published
                    ? 'border-border bg-muted text-foreground hover:bg-muted/80'
                    : undefined
                }
              >
                {isUpdatingPublish ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : activity.published ? (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    {!isMobile && <span className="ml-1.5 text-xs">{t('unpublish')}</span>}
                  </>
                ) : (
                  <>
                    <Globe className="h-3.5 w-3.5" />
                    {!isMobile && <span className="ml-1.5 text-xs">{t('publish')}</span>}
                  </>
                )}
              </Button>
            </PermissionTooltip>

            {/* Preview Button */}
            <ToolTip
              content={t('previewTooltip')}
              sideOffset={8}
            >
              <Button
                size="sm"
                variant="outline"
              >
                <Link
                  href={`${getUriWithOrg(orgslug, '')}/course/${course_uuid.replace(
                    'course_',
                    '',
                  )}/activity/${activity.activity_uuid.replace('activity_', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Eye className="h-4 w-4" />
                </Link>
              </Button>
            </ToolTip>

            {/* Delete Button */}
            <PermissionTooltip
              enabled={canDelete}
              action="delete"
            >
              <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
              >
                <AlertDialogTrigger disabled={!canDelete}>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!canDelete}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogMedia className="bg-muted text-foreground">
                      <AlertTriangle className="size-8" />
                    </AlertDialogMedia>
                    <AlertDialogTitle>{t('deleteTitle', { name: activity.name })}</AlertDialogTitle>
                    <AlertDialogDescription>{t('deleteConfirmation')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending} />
                    <AlertDialogAction
                      variant="destructive"
                      onClick={handleDeleteActivity}
                      disabled={isPending}
                    >
                      {isPending ? (
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
            </PermissionTooltip>
          </div>
        </div>
      )}
    </Draggable>
  );
};

// Sub-components
const ActivityTypeBadge = ({ activityType }: { activityType: ActivityType }) => {
  const t = useTranslations('CourseEdit.ActivityElement');
  const config = ACTIVITY_CONFIG[activityType];

  if (!config) {
    return null;
  }

  const { Icon, translationKey, colorClass } = config;
  const label = t(`ActivityTypes.${translationKey}`);

  return (
    <div className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 ${colorClass}`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="pl-1 text-xs font-medium">{label}</span>
    </div>
  );
};

const ActivityEditButton = ({
  activity,
  orgslug,
  course_uuid,
}: {
  activity: Activity;
  orgslug: string;
  course_uuid: string;
}) => {
  const t = useTranslations('CourseEdit.ActivityElement');
  const org = useOrg() as Organization;
  const course = useCourse() as Course;
  const session = usePlatformSession() as PlatformSession;
  const access_token = session?.data?.tokens?.access_token;
  const isMobile = useIsMobile();

  // Fetch assignment UUID for assignment activities
  const { data: assignmentUUID, isLoading } = useSWR(
    activity.activity_type === 'TYPE_ASSIGNMENT' && access_token
      ? [`assignment-${activity.activity_uuid}`, access_token]
      : null,
    async () => {
      const result = await getAssignmentFromActivityUUID(activity.activity_uuid, access_token!);
      return result?.data?.assignment_uuid?.replace('assignment_', '') ?? null;
    },
  );

  // Dynamic page edit button
  if (activity.activity_type === 'TYPE_DYNAMIC') {
    const editUrl = `${getUriWithOrg(orgslug, '')}/course/${course?.courseStructure?.course_uuid?.replace(
      'course_',
      '',
    )}/activity/${activity.activity_uuid.replace('activity_', '')}/edit`;

    return (
      <Button
        size="sm"
        variant="outline"
      >
        <Link
          href={editUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center"
        >
          <FilePenLine className="h-3.5 w-3.5" />
          {!isMobile && <span className="ml-1.5 text-xs">{t('editPageButton')}</span>}
        </Link>
      </Button>
    );
  }

  // Assignment edit button
  if (activity.activity_type === 'TYPE_ASSIGNMENT') {
    if (isLoading) {
      return (
        <Button
          size="sm"
          variant="outline"
          disabled
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        </Button>
      );
    }

    if (!assignmentUUID) {
      return null;
    }

    const editUrl = `${getUriWithOrg(org?.slug ?? '', '')}/dash/assignments/${assignmentUUID}`;

    return (
      <Button
        size="sm"
        variant="outline"
      >
        <Link
          href={editUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center"
        >
          <FilePenLine className="h-3.5 w-3.5" />
          {!isMobile && <span className="ml-1.5 text-xs">{t('editAssignmentButton')}</span>}
        </Link>
      </Button>
    );
  }

  // Code challenge edit button
  if (activity.activity_type === 'TYPE_CODE_CHALLENGE') {
    const editUrl = `${getUriWithOrg(orgslug, '')}/course/${course?.courseStructure?.course_uuid?.replace(
      'course_',
      '',
    )}/activity/${activity.activity_uuid.replace('activity_', '')}/editor`;

    return (
      <Button
        size="sm"
        variant="outline"
      >
        <Link
          href={editUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center"
        >
          <FilePenLine className="h-3.5 w-3.5" />
          {!isMobile && <span className="ml-1.5 text-xs">{t('configureButton')}</span>}
        </Link>
      </Button>
    );
  }

  return null;
};

export default ActivityElement;
