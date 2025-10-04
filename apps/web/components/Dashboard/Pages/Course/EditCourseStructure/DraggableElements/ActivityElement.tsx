import { Backpack, Eye, File, FilePenLine, Globe, Loader2, Lock, Pencil, Save, Sparkles, Video, X } from 'lucide-react';
import { deleteAssignmentUsingActivityUUID, getAssignmentFromActivityUUID } from '@services/courses/assignments';
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal';
import { deleteActivity, updateActivity } from '@services/courses/activities';
import ToolTip from '@components/Objects/StyledElements/Tooltip/Tooltip';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { getAPIUrl, getUriWithOrg } from '@services/config/config';
import { useCourse } from '@components/Contexts/CourseContext';
import { revalidateTags } from '@services/utils/ts/requests';
import { useOrg } from '@components/Contexts/OrgContext';
import { useCallback, useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Draggable } from '@hello-pangea/dnd';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { mutate } from 'swr';

interface ActivitiyElementProps {
  orgslug: string;
  activity: any;
  activityIndex: any;
  course_uuid: string;
}

interface ModifiedActivityInterface {
  activityId: string;
  activityName: string;
}

const ActivityElement = (props: ActivitiyElementProps) => {
  const router = useRouter();
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const [modifiedActivity, setModifiedActivity] = useState<ModifiedActivityInterface | undefined>();
  const [selectedActivity, setSelectedActivity] = useState<string | undefined>();
  const [isUpdatingName, setIsUpdatingName] = useState<boolean>(false);
  const activityUUID = props.activity.activity_uuid;
  const isMobile = useIsMobile();
  const t = useTranslations('CourseEdit.ActivityElement');
  const course = useCourse();
  const withUnpublishedActivities = course ? course.withUnpublishedActivities : false;

  async function deleteActivityUI() {
    const toast_loading = toast.loading(t('deletingActivity'));
    // Assignments
    if (props.activity.activity_type === 'TYPE_ASSIGNMENT') {
      await deleteAssignmentUsingActivityUUID(props.activity.activity_uuid, access_token);
    }

    await deleteActivity(props.activity.activity_uuid, access_token);
    mutate(`${getAPIUrl()}courses/${props.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`);
    await revalidateTags(['courses'], props.orgslug);
    toast.dismiss(toast_loading);
    toast.success(t('activityDeletedSuccess'));
    router.refresh();
  }

  async function changePublicStatus() {
    const toast_loading = toast.loading(t('updating'));
    await updateActivity(
      {
        ...props.activity,
        published: !props.activity.published,
      },
      props.activity.activity_uuid,
      access_token,
    );
    mutate(`${getAPIUrl()}courses/${props.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`);
    toast.dismiss(toast_loading);
    toast.success(t('activityUpdateSuccess'));
    await revalidateTags(['courses'], props.orgslug);
    router.refresh();
  }

  async function updateActivityName(activityId: string) {
    if (modifiedActivity?.activityId === activityId && selectedActivity !== undefined) {
      setIsUpdatingName(true);

      const modifiedActivityCopy = {
        ...props.activity,
        name: modifiedActivity.activityName,
      };

      try {
        await updateActivity(modifiedActivityCopy, activityUUID, access_token);
        mutate(
          `${getAPIUrl()}courses/${props.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
        );
        await revalidateTags(['courses'], props.orgslug);
        toast.success(t('activityNameUpdatedSuccess'));
        router.refresh();
      } catch (error) {
        toast.error(t('failedToUpdateActivityName'));
        console.error('Error updating activity name:', error);
      } finally {
        setIsUpdatingName(false);
        setSelectedActivity(undefined);
      }
    } else {
      setSelectedActivity(undefined);
    }
  }
  useEffect(() => {}, []);

  return (
    <Draggable
      key={props.activity.activity_uuid}
      draggableId={props.activity.activity_uuid}
      index={props.activityIndex}
    >
      {(provided, snapshot) => (
        <div
          className={`my-2 grid w-full grid-cols-[auto_1fr_auto] gap-2 rounded-md px-3 py-2 text-gray-500 ${
            snapshot.isDragging
              ? 'soft-shadow z-50 scale-[1.04] rotate-1 bg-white ring-2 ring-blue-500/20'
              : 'soft-shadow bg-gray-50 hover:bg-gray-100'
          } items-center border-1 border-gray-200`}
          key={props.activity.id}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          ref={provided.innerRef}
          style={{
            ...provided.draggableProps.style,
          }}
        >
          {/*   Activity Type Icon  */}
          <ActivityTypeIndicator
            activityType={props.activity.activity_type}
            isMobile={isMobile}
            t={t}
          />

          {/*   Centered Activity Name  */}
          <div className="flex items-center justify-center space-x-2">
            {selectedActivity === props.activity.id ? (
              <div className="chapter-modification-zone space-x-3 rounded-lg bg-gray-200/60 px-4 py-1 text-[7px] text-gray-600 shadow-inner">
                <input
                  type="text"
                  className="bg-transparent text-xs text-gray-500 outline-hidden"
                  placeholder={t('activityNamePlaceholder')}
                  value={modifiedActivity ? modifiedActivity?.activityName : props.activity.name}
                  onChange={(e) => {
                    setModifiedActivity({
                      activityId: props.activity.id,
                      activityName: e.target.value,
                    });
                  }}
                  disabled={isUpdatingName}
                />
                <button
                  onClick={() => updateActivityName(props.activity.id)}
                  className="bg-transparent text-neutral-700 hover:cursor-pointer hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isUpdatingName}
                >
                  {isUpdatingName ? (
                    <Loader2
                      size={12}
                      className="animate-spin"
                    />
                  ) : (
                    <Save size={12} />
                  )}
                </button>
              </div>
            ) : (
              <p className="text-center first-letter:uppercase sm:text-left">{props.activity.name}</p>
            )}
            <Pencil
              onClick={() => !isUpdatingName && setSelectedActivity(props.activity.id)}
              className={`size-3 min-w-3 text-neutral-400 hover:cursor-pointer ${isUpdatingName ? 'cursor-not-allowed opacity-50' : ''}`}
            />
          </div>

          {/*   Edit, View, Publish, and Delete Buttons  */}
          <div className="flex items-center justify-end gap-2">
            <ActivityElementOptions
              activity={props.activity}
              isMobile={isMobile}
              t={t}
            />
            {/*   Publishing  */}
            <button
              className={`flex items-center space-x-1 rounded-md border p-1 px-2 text-xs font-semibold shadow-md transition-colors duration-200 sm:px-3 ${
                !props.activity.published
                  ? 'border-green-600/10 bg-linear-to-bl from-green-400/50 to-lime-200/80 text-green-800 hover:from-green-500/50 hover:to-lime-300/80'
                  : 'border-gray-600/10 bg-linear-to-bl from-gray-400/50 to-gray-200/80 text-gray-800 hover:from-gray-500/50 hover:to-gray-300/80'
              }`}
              onClick={() => changePublicStatus()}
              aria-label={!props.activity.published ? t('publishButton') : t('unpublishButton')}
              title={!props.activity.published ? t('publishButton') : t('unpublishButton')}
            >
              {!props.activity.published ? (
                <Globe
                  strokeWidth={2}
                  size={12}
                  className="text-green-600"
                />
              ) : (
                <Lock
                  strokeWidth={2}
                  size={12}
                  className="text-gray-600"
                />
              )}
              <span>{!props.activity.published ? t('publish') : t('unpublish')}</span>
            </button>
            <div className="mx-1 hidden h-3 w-px self-center rounded-full bg-gray-300 sm:block" />
            <ToolTip
              content={t('previewTooltip')}
              sideOffset={8}
            >
              <Link
                href={`${getUriWithOrg(props.orgslug, '')}/course/${props.course_uuid.replace(
                  'course_',
                  '',
                )}/activity/${props.activity.activity_uuid.replace('activity_', '')}`}
                className="flex items-center space-x-1 rounded-md border border-cyan-600/10 bg-linear-to-bl from-sky-400/50 to-cyan-200/80 p-1 px-2 text-xs font-semibold text-cyan-800 shadow-md transition-colors duration-200 hover:from-sky-500/50 hover:to-cyan-300/80 sm:px-3"
                rel="noopener noreferrer"
                aria-label={t('previewTooltip')}
                title={t('previewTooltip')}
              >
                <Eye
                  strokeWidth={2}
                  size={14}
                  className="text-sky-600"
                />
              </Link>
            </ToolTip>
            {/*   Delete Button  */}
            <ConfirmationModal
              confirmationMessage={t('deleteConfirmation')}
              confirmationButtonText={t('deleteButton')}
              dialogTitle={t('deleteTitle', { name: props.activity.name })}
              dialogTrigger={
                <span>
                  <button
                    className="flex items-center space-x-1 rounded-md bg-red-600 p-1 px-2 shadow-md transition-colors duration-200 hover:bg-red-700 sm:px-3"
                    rel="noopener noreferrer"
                    aria-label={t('deleteButton')}
                    title={t('deleteButton')}
                  >
                    <X
                      size={15}
                      className="font-bold text-rose-200"
                    />
                  </button>
                </span>
              }
              functionToExecute={() => deleteActivityUI()}
              status="warning"
            />
          </div>
        </div>
      )}
    </Draggable>
  );
};

const ACTIVITIES = {
  TYPE_VIDEO: {
    Icon: Video,
  },
  TYPE_DOCUMENT: {
    Icon: File,
  },
  TYPE_ASSIGNMENT: {
    Icon: Backpack,
  },
  TYPE_DYNAMIC: {
    Icon: Sparkles,
  },
} as const;

const ACTIVITY_TYPE_TRANSLATION_KEYS = {
  TYPE_VIDEO: 'video',
  TYPE_DOCUMENT: 'document',
  TYPE_ASSIGNMENT: 'assignment',
  TYPE_DYNAMIC: 'dynamic',
} as const;

const ActivityTypeIndicator = ({
  activityType,
  isMobile,
  t,
}: {
  activityType: keyof typeof ACTIVITIES;
  isMobile: boolean;
  t: ReturnType<typeof useTranslations>;
}) => {
  const { Icon } = ACTIVITIES[activityType];

  // Map internal type to translation key
  const translationKey = ACTIVITY_TYPE_TRANSLATION_KEYS[activityType] || 'dynamic';
  const translatedTypeName = t(`ActivityTypes.${translationKey}`);

  return (
    <div className={`flex w-28 space-x-1 text-gray-300 ${isMobile ? 'flex-col' : ''}`}>
      <div className="flex items-center space-x-2">
        <Icon className="size-4" />
        <div className="mx-auto justify-center rounded-full bg-gray-200 px-2 py-1 align-middle text-xs font-semibold text-gray-400">
          {translatedTypeName}
        </div>
      </div>
    </div>
  );
};

const ActivityElementOptions = ({
  activity,
  isMobile,
  t,
}: {
  activity: any;
  isMobile: boolean;
  t: ReturnType<typeof useTranslations>;
}) => {
  const [assignmentUUID, setAssignmentUUID] = useState('');
  const org = useOrg() as any;
  const course = useCourse();
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;

  const getAssignmentUUIDFromActivityUUID = useCallback(
    async (activityUUID: string): Promise<string | undefined> => {
      const assignment = await getAssignmentFromActivityUUID(activityUUID, access_token);
      if (assignment?.data) {
        return assignment.data.assignment_uuid;
      }
      return undefined;
    },
    [access_token],
  );

  const fetchAssignmentUUID = useCallback(async () => {
    if (activity.activity_type === 'TYPE_ASSIGNMENT') {
      const assignment_uuid = await getAssignmentUUIDFromActivityUUID(activity.activity_uuid);
      if (assignment_uuid) setAssignmentUUID(assignment_uuid.replace('assignment_', ''));
    }
  }, [activity.activity_type, activity.activity_uuid, getAssignmentUUIDFromActivityUUID]);

  useEffect(() => {
    fetchAssignmentUUID();
  }, [fetchAssignmentUUID]);

  return (
    <>
      {activity.activity_type === 'TYPE_DYNAMIC' && (
        <Link
          href={`${getUriWithOrg(org.slug, '')}/course/${course?.courseStructure.course_uuid.replace(
            'course_',
            '',
          )}/activity/${activity.activity_uuid.replace('activity_', '')}/edit`}
          className={`p-1 hover:cursor-pointer ${isMobile ? 'px-2' : 'px-3'} items-center rounded-md bg-sky-700`}
          target="_blank"
        >
          <div className="flex items-center space-x-1 text-xs font-semibold text-sky-100">
            <FilePenLine size={12} />
            <span>{t('editPageButton')}</span>
          </div>
        </Link>
      )}
      {activity.activity_type === 'TYPE_ASSIGNMENT' && assignmentUUID ? (
        <Link
          href={`${getUriWithOrg(org.slug, '')}/dash/assignments/${assignmentUUID}`}
          className={`p-1 hover:cursor-pointer ${isMobile ? 'px-2' : 'px-3'} items-center rounded-md bg-teal-700`}
        >
          <div className="flex items-center space-x-1 text-xs font-semibold text-sky-100">
            <FilePenLine size={12} /> {!isMobile && <span>{t('editAssignmentButton')}</span>}
          </div>
        </Link>
      ) : null}
    </>
  );
};

export default ActivityElement;
