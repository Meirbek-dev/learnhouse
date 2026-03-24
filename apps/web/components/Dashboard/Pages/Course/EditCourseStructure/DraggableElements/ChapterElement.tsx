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
  ChevronDown,
  ChevronRight,
  GripVertical,
  Hexagon,
  Loader2,
  MoreHorizontal,
  Pencil,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useChapterMutations } from '@/hooks/mutations/useChapterMutations';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

import NewActivityButton from '../Buttons/NewActivityButton';
import ActivityElement from './ActivityElement';

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
  course_uuid: string;
  defaultExpanded?: boolean;
  onAddActivity?: (chapterId: number) => void;
}

interface PlatformSession {
  data?: {
    tokens?: {
      access_token?: string;
    };
  };
}

const ChapterElement = ({ chapter, chapterIndex, course_uuid, defaultExpanded = false, onAddActivity }: ChapterElementProps) => {
  const session = usePlatformSession() as PlatformSession;
  const access_token = session?.data?.tokens?.access_token;
  const { deleteChapter, updateChapter } = useChapterMutations(course_uuid, true);
  const t = useTranslations('CourseEdit');

  // Local state (replaces courseStructureStore)
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(chapter?.name ?? '');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingChapter, setIsDeletingChapter] = useState(false);

  const activities = chapter.activities ?? [];

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
      toast.error('Authentication required');
      return;
    }

    const trimmedName = editedName.trim();
    if (!trimmedName || trimmedName === chapter.name) {
      handleCancelEdit();
      return;
    }

    setIsSavingEdit(true);
    try {
      await updateChapter(chapter.chapter_uuid, { name: trimmedName }, access_token);
      setIsEditing(false);
    } catch (error: any) {
      toast.error(error?.message || t('chapterUpdateFailed'));
      setEditedName(chapter.name);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteChapter = async () => {
    if (!access_token) {
      toast.error('Authentication required');
      return;
    }

    setIsDeletingChapter(true);
    try {
      await deleteChapter(chapter.chapter_uuid, access_token);
      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      toast.error(error?.message || t('chapterDeleteFailed'));
      setIsDeleteDialogOpen(false);
    } finally {
      setIsDeletingChapter(false);
    }
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

  if (!chapter?.chapter_uuid) {
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
          className={cn(
            'mb-4 rounded-xl border bg-card shadow-sm transition-all duration-200',
            snapshot.isDragging ? 'shadow-2xl ring-2 ring-ring/30' : 'hover:shadow-md',
          )}
        >
          {/* Chapter Header */}
          <div className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
            {/* Left Section: Drag Handle + Icon + Name */}
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {/* Drag Handle */}
              <div
                {...provided.dragHandleProps}
                className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
              >
                <GripVertical className="h-5 w-5" />
              </div>

              {/* Chapter Icon */}
              <div className="bg-muted flex-shrink-0 rounded-lg p-2">
                <Hexagon
                  className="text-muted-foreground h-4 w-4"
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
                      disabled={isSavingEdit}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleSaveEdit}
                      disabled={isSavingEdit || !editedName.trim()}
                      className="h-8 w-8 p-0"
                    >
                      {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      disabled={isSavingEdit}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="group flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsExpanded((v) => !v)}
                      className="h-7 w-7 p-0"
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                    <h3 className="truncate text-sm font-medium text-foreground sm:text-base">{chapter.name}</h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {activities.length}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleStartEdit}
                      className="h-7 w-7 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Section: Actions */}
            <div className="flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                    />
                  }
                >
                  <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleStartEdit}>
                    <Pencil className="mr-2 h-4 w-4" />
                    {t('edit')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('deleteChapterButton')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogMedia className="bg-muted text-foreground">
                      <AlertTriangle className="size-8" />
                    </AlertDialogMedia>
                    <AlertDialogTitle>{t('deleteChapterTitle', { name: chapter.name })}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {activities.length > 0
                        ? t('deleteChapterConfirmationWithCount', { count: activities.length })
                        : t('deleteChapterConfirmation')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeletingChapter} />
                    <AlertDialogAction
                      variant="destructive"
                      onClick={handleDeleteChapter}
                      disabled={isDeletingChapter}
                    >
                      {isDeletingChapter ? (
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
          {isExpanded ? (
            <>
              <Droppable
                droppableId={chapter.chapter_uuid}
                type="activity"
              >
                {(provided, droppableSnapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'min-h-[80px] rounded-lg px-4 py-3 transition-colors',
                      droppableSnapshot.isDraggingOver && 'bg-muted/50',
                    )}
                  >
                    {activities.length > 0 ? (
                      activities.map((activity, index) => (
                        <ActivityElement
                          key={activity.activity_uuid}
                          course_uuid={course_uuid}
                          activityIndex={index}
                          activity={activity}
                        />
                      ))
                    ) : (
                      <div className="flex min-h-[60px] items-center justify-center text-sm text-muted-foreground">
                        {t('noActivities')}
                      </div>
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              <div className="px-4 pb-4">
                {onAddActivity ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => onAddActivity(chapter.id)}
                  >
                    + {t('addActivityButton')}
                  </Button>
                ) : (
                  <NewActivityButton chapterId={chapter.id} />
                )}
              </div>
            </>
          ) : null}
        </div>
      )}
    </Draggable>
  );
};

export default ChapterElement;
