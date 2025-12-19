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
import { AlertTriangle, GripVertical, Hexagon, Loader2, MoreHorizontal, Pencil, Save, Trash2, X } from 'lucide-react';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { deleteChapter, updateChapter } from '@services/courses/chapters';
import { useCourse } from '@components/Contexts/CourseContext';
import { revalidateTags } from '@services/utils/ts/requests';
import { useState, useTransition } from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { getAPIUrl } from '@services/config/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { mutate } from 'swr';

import NewActivityButton from '../Buttons/NewActivityButton';
import ActivityElement from './ActivityElement';

// Types
type ActivityType = 'TYPE_VIDEO' | 'TYPE_DOCUMENT' | 'TYPE_ASSIGNMENT' | 'TYPE_DYNAMIC';

interface Activity {
  id: string;
  activity_uuid: string;
  activity_type: ActivityType;
  name: string;
  published: boolean;
  [key: string]: any;
}

interface Chapter {
  id: number;
  chapter_uuid: string;
  name: string;
  activities?: Activity[];
}

interface ChapterElementProps {
  chapter: Chapter;
  chapterIndex: number;
  orgslug: string;
  course_uuid: string;
}

interface PlatformSession {
  data?: {
    tokens?: {
      access_token?: string;
    };
  };
}

const ChapterElement = ({ chapter, chapterIndex, orgslug, course_uuid }: ChapterElementProps) => {
  // Hooks
  const session = usePlatformSession() as PlatformSession;
  const access_token = session?.data?.tokens?.access_token;
  const course = useCourse();
  const router = useRouter();
  const t = useTranslations('CourseEdit');
  const [isPending, startTransition] = useTransition();

  // State
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(chapter?.name ?? '');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Derived values
  const activities = chapter.activities ?? [];
  const withUnpublishedActivities = course?.withUnpublishedActivities ?? false;
  const courseMetaUrl = `${getAPIUrl()}courses/${course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`;

  // Handlers
  const handleStartEdit = () => {
    setIsEditing(true);
    setEditedName(chapter.name);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedName(chapter.name);
  };

  const handleSaveEdit = async () => {
    if (!access_token) {
      console.error('No access token available');
      return;
    }

    const trimmedName = editedName.trim();
    if (!trimmedName || trimmedName === chapter.name) {
      handleCancelEdit();
      return;
    }

    startTransition(async () => {
      try {
        await updateChapter(chapter.id, { name: trimmedName }, access_token);
        await mutate(courseMetaUrl);
        await revalidateTags(['courses'], orgslug);
        setIsEditing(false);
        router.refresh();
      } catch (error) {
        console.error('Failed to update chapter:', error);
        // Reset to original name on error
        setEditedName(chapter.name);
      }
    });
  };

  const handleDeleteChapter = async () => {
    if (!access_token) {
      console.error('No access token available');
      return;
    }

    startTransition(async () => {
      try {
        await deleteChapter(chapter.id, access_token);
        await mutate(courseMetaUrl);
        await revalidateTags(['courses'], orgslug);
        setIsDeleteDialogOpen(false);
        router.refresh();
      } catch (error) {
        console.error('Failed to delete chapter:', error);
        setIsDeleteDialogOpen(false);
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

  // Early validation (moved below all hooks to satisfy Rules of Hooks)
  if (!chapter?.chapter_uuid) {
    console.error('ChapterElement: Invalid chapter data', chapter);
    return null;
  }

  return (
    <Draggable
      draggableId={chapter.chapter_uuid}
      index={chapterIndex}
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`
            bg-background mx-2 mb-4 rounded-xl shadow-sm
            transition-all duration-200
            sm:mx-4 md:mx-6 lg:mx-10
            ${snapshot.isDragging ? 'scale-105 rotate-1 shadow-2xl ring-2 ring-blue-500/30' : 'hover:shadow-md'}
          `}
        >
          {/* Chapter Header */}
          <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-4 sm:px-6">
            {/* Left Section: Drag Handle + Icon + Name */}
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {/* Drag Handle */}
              <div
                {...provided.dragHandleProps}
                className="cursor-grab text-neutral-400 hover:text-neutral-600 active:cursor-grabbing"
              >
                <GripVertical className="h-5 w-5" />
              </div>

              {/* Chapter Icon */}
              <div className="flex-shrink-0 rounded-lg bg-blue-50 p-2">
                <Hexagon
                  className="h-4 w-4 text-blue-600"
                  strokeWidth={2.5}
                />
              </div>

              {/* Chapter Name - Editable */}
              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t('chapterNamePlaceholder')}
                      className="h-8 text-sm"
                      autoFocus
                      disabled={isPending}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleSaveEdit}
                      disabled={isPending || !editedName.trim()}
                      className="h-8 w-8 p-0"
                    >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      disabled={isPending}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="group flex items-center gap-2">
                    <h3 className="truncate text-sm font-medium text-neutral-900 sm:text-base">{chapter.name}</h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleStartEdit}
                      className="h-7 w-7 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Pencil className="h-3.5 w-3.5 text-neutral-500" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Section: Delete Button */}
            <div className="flex-shrink-0">
              <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
              >
                <AlertDialogTrigger>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogMedia className="bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400">
                      <AlertTriangle className="size-8" />
                    </AlertDialogMedia>
                    <AlertDialogTitle>{t('deleteChapterTitle', { name: chapter.name })}</AlertDialogTitle>
                    <AlertDialogDescription>{t('deleteChapterConfirmation')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending} />
                    <AlertDialogAction
                      variant="destructive"
                      onClick={handleDeleteChapter}
                      disabled={isPending}
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('deleting')}
                        </>
                      ) : (
                        t('deleteChapterButton')
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Activities Droppable Area */}
          <Droppable
            droppableId={chapter.chapter_uuid}
            type="activity"
          >
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`
                  min-h-[80px] rounded-lg px-4 py-3 transition-colors
                  ${snapshot.isDraggingOver ? 'bg-blue-50/50' : ''}
                `}
              >
                {activities.length > 0 ? (
                  activities.map((activity, index) => (
                    <ActivityElement
                      key={activity.activity_uuid}
                      orgslug={orgslug}
                      course_uuid={course_uuid}
                      activityIndex={index}
                      activity={activity}
                    />
                  ))
                ) : (
                  <div className="flex min-h-[60px] items-center justify-center text-sm text-neutral-400">
                    {t('noActivities', { default: 'No activities yet' })}
                  </div>
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {/* New Activity Button */}
          <div className="px-4 pb-4">
            <NewActivityButton
              orgslug={orgslug}
              chapterId={chapter.id}
            />
          </div>

          {/* Bottom Separator */}
          <div className="flex h-8 items-center justify-center border-t border-neutral-100">
            <MoreHorizontal className="h-5 w-5 text-neutral-300" />
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default ChapterElement;
