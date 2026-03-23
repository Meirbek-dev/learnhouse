'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useChapterMutations } from '@/hooks/mutations/useChapterMutations';
import { useCourse } from '@components/Contexts/CourseContext';
import { useCourseEditorStore } from '@/stores/courses';
import { useCourseStructureStore } from '@/stores/courses';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import NewChapterModal from '@components/Objects/Modals/Chapters/NewChapter';
import { AlertTriangle, CheckCircle2, Hexagon, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import type { CourseOrderPayload } from '@/schemas/chapterSchemas';
import ChapterElement from './DraggableElements/ChapterElement';

const EditCourseStructure = () => {
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('CourseEdit.Structure');

  const course = useCourse();
  const course_structure = course.courseStructure;
  const setConflict = useCourseEditorStore((state) => state.setConflict);
  const course_uuid = course ? course.courseStructure.course_uuid : '';
  const { createChapter, reorderStructure } = useChapterMutations(course_uuid, true);
  const expandedChapterIds = useCourseStructureStore((state) => state.expandedChapterIds);
  const setExpanded = useCourseStructureStore((state) => state.setExpanded);
  // New Chapter creation
  const [newChapterModal, setNewChapterModal] = useState(false);
  const [structureStatus, setStructureStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Auto-dismiss the 'saved' banner after 3 seconds
  useEffect(() => {
    if (structureStatus !== 'saved') return;
    const timer = setTimeout(() => setStructureStatus('idle'), 3000);
    return () => clearTimeout(timer);
  }, [structureStatus]);

  useEffect(() => {
    if (course_structure.chapters.length === 0 || expandedChapterIds.size > 0) {
      return;
    }

    const firstChapter = course_structure.chapters[0];
    if (!firstChapter) {
      return;
    }

    setExpanded(firstChapter.chapter_uuid, true);
  }, [course_structure.chapters, expandedChapterIds.size, setExpanded]);

  const closeNewChapterModal = async () => {
    setNewChapterModal(false);
  };

  // Submit new chapter
  const submitChapter = async (chapter: any) => {
    setStructureStatus('saving');
    try {
      await createChapter(chapter, {
        accessToken: access_token,
        lastKnownUpdateDate: course_structure.update_date,
      });
      setNewChapterModal(false);
      setStructureStatus('saved');
      toast.success(t('chapterCreatedSuccess'));
    } catch (error: any) {
      if (error?.status === 409) {
        setConflict({
          section: 'content',
          message: error?.detail || error?.message,
          pendingSave: async () => {
            await createChapter(chapter, {
              accessToken: access_token,
              lastKnownUpdateDate: course_structure.update_date,
            });
          },
        });
        return;
      }
      setStructureStatus('error');
      toast.error(t('chapterCreateFailed'));
    }
  };

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
      const sourceChapter = newChapterOrder.find((chapter: any) => chapter.chapter_uuid === source.droppableId);
      const destinationChapter =
        newChapterOrder.find((chapter: any) => chapter.chapter_uuid === destination.droppableId) ?? sourceChapter;

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
      await reorderStructure(newCourseStructure, payload, {
        accessToken: access_token,
        lastKnownUpdateDate: course_structure.update_date,
      });
      setStructureStatus('saved');
    } catch (error: any) {
      if (error?.status === 409) {
        setConflict({
          section: 'content',
          message: error?.detail || error?.message,
          pendingSave: async () => {
            await reorderStructure(newCourseStructure, payload, {
              accessToken: access_token,
              lastKnownUpdateDate: course_structure.update_date,
            });
          },
        });
        return;
      }
      setStructureStatus('error');
      toast.error(error?.message || t('saveOrderError'));
    }
  };

  if (!course) return <PageLoading />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          {structureStatus !== 'idle' && (
            <Alert className="border-border bg-muted/40">
              {structureStatus === 'saving' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : structureStatus === 'error' ? (
                <AlertTriangle className="size-4" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              <AlertTitle>
                {structureStatus === 'saving'
                  ? t('savingOrder')
                  : structureStatus === 'error'
                    ? t('saveOrderError')
                    : t('curriculumChangesApplyImmediately')}
              </AlertTitle>
              <AlertDescription>
                {structureStatus === 'error' ? t('refreshAfterError') : t('curriculumInlineFeedback')}
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>
      </Card>

      <DragDropContext onDragEnd={updateStructure}>
        <Droppable
          type="chapter"
          droppableId="chapters"
          direction="vertical"
        >
          {(provided, snapshot) => (
            <div
              className={`space-y-4 ${snapshot.isDraggingOver ? 'bg-muted/40' : ''}`}
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              {course_structure.chapters.map((chapter: any, index: any) => {
                return (
                  <ChapterElement
                    key={chapter.chapter_uuid}
                    chapterIndex={index}
                    course_uuid={course_uuid}
                    chapter={chapter}
                  />
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        <Card>
          <CardContent className="flex justify-center py-10">
            <Dialog
              open={newChapterModal}
              onOpenChange={setNewChapterModal}
            >
              <DialogTrigger
                render={<Button className="flex h-auto flex-row items-center rounded-xl px-6 py-5 shadow-xs" />}
              >
                <Hexagon
                  strokeWidth={3}
                  size={16}
                />
                <span className="text-sm font-semibold">{t('addChapterButton')}</span>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('NewChapterModal.title')}</DialogTitle>
                  <DialogDescription>{t('NewChapterModal.description')}</DialogDescription>
                </DialogHeader>
                <NewChapterModal
                  course={course ? course.courseStructure : null}
                  closeModal={closeNewChapterModal}
                  submitChapter={submitChapter}
                />
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </DragDropContext>
    </div>
  );
};

export default EditCourseStructure;
