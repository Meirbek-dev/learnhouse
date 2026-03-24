'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Hexagon,
  LayoutList,
  Loader2,
  PlusCircle,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useActivityMutations } from '@/hooks/mutations/useActivityMutations';
import { useChapterMutations } from '@/hooks/mutations/useChapterMutations';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import NewActivityModal from '@components/Objects/Modals/Activities/Create/NewActivity';
import { useCourse } from '@components/Contexts/CourseContext';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import type { CourseOrderPayload } from '@/schemas/chapterSchemas';
import ChapterElement from './DraggableElements/ChapterElement';

interface SelectedPanel {
  chapterId: number;
}

const CurriculumEditor = () => {
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const tStructure = useTranslations('CourseEdit.Structure');
  const tNotify = useTranslations('DashPage.Notifications');

  const course = useCourse();
  const course_structure = course.courseStructure;
  const course_uuid = course_structure.course_uuid;
  const { createChapter, reorderStructure } = useChapterMutations(course_uuid, true);
  const activityMutations = useActivityMutations(course_uuid, true);

  // Panel state — which chapter is active in the right panel
  const [selectedPanel, setSelectedPanel] = useState<SelectedPanel | null>(null);

  // Inline chapter creation state
  const [showChapterInput, setShowChapterInput] = useState(false);
  const [newChapterName, setNewChapterName] = useState('');
  const [isCreatingChapter, setIsCreatingChapter] = useState(false);
  const newChapterInputRef = useRef<HTMLInputElement>(null);

  // Structure save status
  const [structureStatus, setStructureStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (structureStatus !== 'saved') return;
    const timer = setTimeout(() => setStructureStatus('idle'), 3000);
    return () => clearTimeout(timer);
  }, [structureStatus]);

  useEffect(() => {
    if (!showChapterInput) return;
    newChapterInputRef.current?.focus();
  }, [showChapterInput]);

  // --- Chapter creation ---
  const handleStartNewChapter = () => {
    setShowChapterInput(true);
    setNewChapterName('');
  };

  const handleCancelNewChapter = () => {
    setShowChapterInput(false);
    setNewChapterName('');
  };

  const handleSubmitNewChapter = async () => {
    const name = newChapterName.trim();
    if (!name) {
      handleCancelNewChapter();
      return;
    }

    setIsCreatingChapter(true);
    try {
      await createChapter({ name, course_id: course.courseStructure.id }, access_token);
      toast.success(tStructure('chapterCreatedSuccess'));
      setShowChapterInput(false);
      setNewChapterName('');
    } catch (error: any) {
      toast.error(tStructure('chapterCreateFailed'));
    } finally {
      setIsCreatingChapter(false);
    }
  };

  const handleChapterInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSubmitNewChapter();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelNewChapter();
    }
  };

  // --- Drag-and-drop reorder ---
  const updateStructure = async (result: any) => {
    const { destination, source, type } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newCourseStructure = structuredClone(course_structure);

    if (type === 'chapter') {
      const newChapterOrder = [...newCourseStructure.chapters];
      const [movedChapter] = newChapterOrder.splice(source.index, 1);
      if (!movedChapter) return;
      newChapterOrder.splice(destination.index, 0, movedChapter);
      newCourseStructure.chapters = newChapterOrder;
    }

    if (type === 'activity') {
      const newChapterOrder = [...newCourseStructure.chapters];
      const sourceChapter = newChapterOrder.find((c: any) => c.chapter_uuid === source.droppableId);
      const destinationChapter =
        newChapterOrder.find((c: any) => c.chapter_uuid === destination.droppableId) ?? sourceChapter;

      if (!(sourceChapter && destinationChapter)) return;
      if (!(sourceChapter.activities && destinationChapter.activities)) return;

      const [movedActivity] = sourceChapter.activities.splice(source.index, 1);
      if (!movedActivity) return;
      destinationChapter.activities.splice(destination.index, 0, movedActivity);
      newCourseStructure.chapters = newChapterOrder;
    }

    const payload: CourseOrderPayload = {
      chapter_order_by_uuids: newCourseStructure.chapters.map((chapter: any) => ({
        chapter_uuid: chapter.chapter_uuid,
        activities_order_by_uuids: (chapter.activities || []).map((activity: any) => activity.activity_uuid),
      })),
    };

    try {
      setStructureStatus('saving');
      await reorderStructure(newCourseStructure, payload, access_token);
      setStructureStatus('saved');
    } catch (error: any) {
      setStructureStatus('error');
      toast.error(error?.message || tStructure('saveOrderError'));
    }
  };

  // --- Activity creation callbacks (passed to right panel) ---
  const handleClosePanel = () => setSelectedPanel(null);

  const submitActivity = async (activity: any) => {
    if (!selectedPanel) return;
    const toastId = toast.loading(tNotify('creatingActivity'));
    try {
      await activityMutations.createActivity(activity, selectedPanel.chapterId, access_token);
      toast.success(tNotify('activityCreatedSuccess'));
      setSelectedPanel(null);
    } catch (error: any) {
      toast.error(error?.message || tNotify('uploadFailed'));
    } finally {
      toast.dismiss(toastId);
    }
  };

  const submitFileActivity = async (file: any, type: any, activity: any, chapterId: number) => {
    const toastId = toast.loading(tNotify('uploadingAndCreating'));
    try {
      await activityMutations.createFileActivity(
        file,
        type,
        activity,
        chapterId,
        access_token,
        (progress) => {
          toast.loading(`${tNotify('uploadingAndCreating')} ${progress.percentage}%`, { id: toastId });
        },
      );
      setSelectedPanel(null);
      toast.success(tNotify('activityCreatedSuccess'));
    } catch (error: any) {
      toast.error(error?.message || tNotify('uploadFailed'));
    } finally {
      toast.dismiss(toastId);
    }
  };

  const submitExternalVideo = async (external_video_data: any, activity: any) => {
    if (!selectedPanel) return;
    const toastId = toast.loading(tNotify('creatingActivity'));
    try {
      await activityMutations.createExternalVideo(
        external_video_data,
        activity,
        selectedPanel.chapterId,
        access_token,
      );
      setSelectedPanel(null);
      toast.success(tNotify('activityCreatedSuccess'));
    } catch (error: any) {
      toast.error(error?.message || tNotify('uploadFailed'));
    } finally {
      toast.dismiss(toastId);
    }
  };

  if (!course) return null;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      {/* ── Left: Outline ── */}
      <div className="min-w-0">
        {structureStatus !== 'idle' && (
          <Alert className="mb-4 border-border bg-muted/40">
            {structureStatus === 'saving' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : structureStatus === 'error' ? (
              <AlertTriangle className="size-4" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            <AlertTitle>
              {structureStatus === 'saving'
                ? tStructure('savingOrder')
                : structureStatus === 'error'
                  ? tStructure('saveOrderError')
                  : tStructure('curriculumChangesApplyImmediately')}
            </AlertTitle>
            <AlertDescription>
              {structureStatus === 'error' ? tStructure('refreshAfterError') : tStructure('curriculumInlineFeedback')}
            </AlertDescription>
          </Alert>
        )}

        <DragDropContext onDragEnd={updateStructure}>
          <Droppable
            type="chapter"
            droppableId="chapters"
            direction="vertical"
          >
            {(provided, snapshot) => (
              <div
                className={cn('space-y-4', snapshot.isDraggingOver && 'bg-muted/40 rounded-xl')}
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {course_structure.chapters.map((chapter: any, index: any) => (
                  <ChapterElement
                    key={chapter.chapter_uuid}
                    chapterIndex={index}
                    course_uuid={course_uuid}
                    chapter={chapter}
                    defaultExpanded={index === 0}
                    onAddActivity={(chapterId) => setSelectedPanel({ chapterId })}
                  />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* Inline chapter creation */}
        <div className="mt-4">
          {showChapterInput ? (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-primary/50 bg-muted/30 px-4 py-3">
              <Hexagon
                className="size-4 shrink-0 text-muted-foreground"
                strokeWidth={2.5}
              />
              <Input
                ref={newChapterInputRef}
                value={newChapterName}
                onChange={(e) => setNewChapterName(e.target.value)}
                onKeyDown={handleChapterInputKeyDown}
                placeholder={tStructure('chapterNamePlaceholder')}
                className="h-8 flex-1 text-sm"
                disabled={isCreatingChapter}
              />
              <Button
                size="sm"
                onClick={() => void handleSubmitNewChapter()}
                disabled={isCreatingChapter || !newChapterName.trim()}
                className="h-8"
              >
                {isCreatingChapter ? <Loader2 className="size-4 animate-spin" /> : tStructure('confirmChapter')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelNewChapter}
                disabled={isCreatingChapter}
                className="h-8"
              >
                {tStructure('cancel')}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full rounded-xl border-dashed py-5"
              onClick={handleStartNewChapter}
            >
              <Hexagon
                strokeWidth={3}
                className="mr-2 size-4"
              />
              {tStructure('addChapterButton')}
            </Button>
          )}
        </div>
      </div>

      {/* ── Right: Content Panel ── */}
      <div className="min-w-0">
        {selectedPanel ? (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <NewActivityModal
              closeModal={handleClosePanel}
              submitFileActivity={submitFileActivity}
              submitExternalVideo={submitExternalVideo}
              submitActivity={submitActivity}
              chapterId={selectedPanel.chapterId}
              course={course}
            />
          </div>
        ) : (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 p-8 text-center">
            <div className="rounded-full bg-muted p-3">
              <LayoutList className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {tStructure('selectItemHint')}
            </p>
            <p className="max-w-xs text-xs text-muted-foreground/70">
              {tStructure('selectItemHintDescription')}
            </p>
            {course_structure.chapters.length === 0 ? (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={handleStartNewChapter}
              >
                <PlusCircle className="mr-2 size-4" />
                {tStructure('addChapterButton')}
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default CurriculumEditor;
