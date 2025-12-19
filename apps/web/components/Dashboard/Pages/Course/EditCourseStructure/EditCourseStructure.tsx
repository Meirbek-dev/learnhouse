'use client';

import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext';
import NewChapterModal from '@components/Objects/Modals/Chapters/NewChapter';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { revalidateTags } from '@services/utils/ts/requests';
import { createChapter } from '@services/courses/chapters';
import { getAPIUrl } from '@services/config/config';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Hexagon } from 'lucide-react';
import { toast } from 'sonner';
import { mutate } from 'swr';

import ChapterElement from './DraggableElements/ChapterElement';

interface EditCourseStructureProps {
  orgslug: string;
  course_uuid?: string;
}

export type OrderPayload =
  | {
      chapter_order_by_ids?: {
        chapter_id: number;
        activities_order_by_ids: {
          activity_id: number;
        }[];
      }[];
    }
  | undefined;

const EditCourseStructure = (props: EditCourseStructureProps) => {
  const router = useRouter();
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  // Check window availability - use lazy initialization
  const [winReady, setwinReady] = useState(() => typeof window !== 'undefined');
  const t = useTranslations('CourseEdit.Structure');

  const dispatchCourse = useCourseDispatch();

  const [_order, _setOrder] = useState<OrderPayload>();
  const course = useCourse();
  const course_structure = course.courseStructure;
  const course_uuid = course ? course.courseStructure.course_uuid : '';
  const withUnpublishedActivities = course ? course.withUnpublishedActivities : false;
  // New Chapter creation
  const [newChapterModal, setNewChapterModal] = useState(false);

  const closeNewChapterModal = async () => {
    setNewChapterModal(false);
  };

  // Submit new chapter
  const submitChapter = async (chapter: any) => {
    const loadingToast = toast.loading(t('creatingChapter'));
    try {
      await createChapter(chapter, access_token);
      mutate(
        `${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
      );
      await revalidateTags(['courses'], props.orgslug);
      router.refresh();
      setNewChapterModal(false);
      toast.success(t('chapterCreatedSuccess'), { id: loadingToast });
    } catch (error) {
      console.error('Error creating chapter:', error);
      toast.error(t('chapterCreateFailed'), { id: loadingToast });
    }
  };

  const updateStructure = (result: any) => {
    const { destination, source, draggableId, type } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newCourseStructure = { ...course_structure };

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

    dispatchCourse({
      type: 'setCourseStructure',
      payload: newCourseStructure,
    });
    dispatchCourse({ type: 'setIsNotSaved' });
  };

  if (!course) return <PageLoading />;

  return (
    <div className="flex flex-col">
      <div className="h-6" />
      {winReady ? (
        <DragDropContext onDragEnd={updateStructure}>
          <Droppable
            type="chapter"
            droppableId="chapters"
            direction="vertical"
          >
            {(provided, snapshot) => (
              <div
                className={`space-y-4 ${snapshot.isDraggingOver ? 'bg-gray-50/50' : ''}`}
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {course_structure.chapters.map((chapter: any, index: any) => {
                  return (
                    <ChapterElement
                      key={chapter.chapter_uuid}
                      chapterIndex={index}
                      orgslug={props.orgslug}
                      course_uuid={course_uuid}
                      chapter={chapter}
                    />
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {/* New Chapter Modal */}
          <Modal
            isDialogOpen={newChapterModal}
            onOpenChange={setNewChapterModal}
            minHeight="sm"
            dialogContent={
              <NewChapterModal
                course={course ? course.courseStructure : null}
                closeModal={closeNewChapterModal}
                submitChapter={submitChapter}
              />
            }
            dialogTitle={t('NewChapterModal.title')}
            dialogDescription={t('NewChapterModal.description')}
            dialogTrigger={
              <div className="mx-auto my-16 flex h-10 max-w-(--breakpoint-2xl) flex-row items-center rounded-xl bg-cyan-800 px-6 py-5 text-white shadow-xs">
                <div className="mx-auto flex items-center space-x-2 hover:cursor-pointer">
                  <Hexagon
                    strokeWidth={3}
                    size={16}
                    className="text-sm text-white"
                  />
                  <div className="text-sm font-semibold">{t('addChapterButton')}</div>
                </div>
              </div>
            }
          />
        </DragDropContext>
      ) : null}
    </div>
  );
};

export default EditCourseStructure;
