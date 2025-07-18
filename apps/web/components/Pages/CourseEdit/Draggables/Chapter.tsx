import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal';
import { Hexagon, MoreVertical, Pencil, Save, Sparkles, X } from 'lucide-react';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useCourse } from '@components/Contexts/CourseContext';
import { revalidateTags } from '@services/utils/ts/requests';
import { updateChapter } from '@services/courses/chapters';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { getAPIUrl } from '@services/config/config';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { mutate } from 'swr';

import Activity from './Activity';

interface ModifiedChapterInterface {
  chapterId: number;
  chapterName: string;
}

function Chapter(props: any) {
  const router = useRouter();
  const session = useLHSession() as any;
  const t = useTranslations('CourseEdit');
  const [modifiedChapter, setModifiedChapter] = useState<ModifiedChapterInterface | undefined>();
  const [selectedChapter, setSelectedChapter] = useState<string | undefined>();
  const course = useCourse() as any;
  const withUnpublishedActivities = course ? course.withUnpublishedActivities : false;

  async function updateChapterName(chapterId: number) {
    if (modifiedChapter?.chapterId === chapterId) {
      const modifiedChapterCopy = {
        name: modifiedChapter.chapterName,
      };
      await updateChapter(chapterId, modifiedChapterCopy, session.data?.tokens?.access_token);
      await mutate(
        `${getAPIUrl()}chapters/course/${props.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
      );
      await revalidateTags(['courses'], props.orgslug);
      router.refresh();
    }
    setSelectedChapter(undefined);
  }

  return (
    <Draggable
      key={props.info.list.chapter.uuid}
      draggableId={String(props.info.list.chapter.uuid)}
      index={props.index}
    >
      {(provided, _snapshot) => (
        <div
          {...provided.dragHandleProps}
          {...provided.draggableProps}
          ref={provided.innerRef}
          className="max-w-(--breakpoint-2xl) mx-auto mb-5 block rounded-lg border border-white/[0.19] bg-white px-5 py-3 text-[15px] shadow-sm transition-all duration-200 ease-in-out [&_h3]:px-5"
          key={props.info.list.chapter.id}
        >
          <div className="text-md flex items-center space-x-2 pr-3 pt-3 font-bold">
            <div className="flex grow items-center space-x-3 rounded-md px-3 py-1 text-lg">
              <div className="rounded-md bg-neutral-100 p-2">
                <Hexagon
                  strokeWidth={3}
                  size={16}
                  className="text-neutral-600"
                />
              </div>

              <div className="flex items-center space-x-2">
                {selectedChapter === props.info.list.chapter.id ? (
                  <div className="chapter-modification-zone space-x-3 rounded-lg bg-neutral-100 px-4 py-1">
                    <input
                      type="text"
                      className="outline-hidden bg-transparent text-sm text-neutral-700"
                      placeholder={t('chapterNamePlaceholder')}
                      value={modifiedChapter ? modifiedChapter?.chapterName : props.info.list.chapter.name}
                      onChange={(e) =>
                        setModifiedChapter({
                          chapterId: props.info.list.chapter.id,
                          chapterName: e.target.value,
                        })
                      }
                    />
                    <button
                      onClick={() => updateChapterName(props.info.list.chapter.id)}
                      className="bg-transparent text-neutral-700 hover:cursor-pointer hover:text-neutral-900"
                    >
                      <Save
                        size={15}
                        onClick={() => updateChapterName(props.info.list.chapter.id)}
                      />
                    </button>
                  </div>
                ) : (
                  <p className="text-neutral-700 first-letter:uppercase">{props.info.list.chapter.name}</p>
                )}
                <Pencil
                  size={15}
                  className="text-neutral-600 hover:cursor-pointer"
                  onClick={() => setSelectedChapter(props.info.list.chapter.id)}
                />
              </div>
            </div>
            <MoreVertical
              size={15}
              className="text-gray-300"
            />
            <ConfirmationModal
              confirmationButtonText={t('deleteChapterButton')}
              confirmationMessage={t('deleteChapterConfirmation')}
              dialogTitle={t('deleteChapterTitle', {
                name: props.info.list.chapter.name,
              })}
              dialogTrigger={
                <div
                  className="flex items-center space-x-1 rounded-md bg-red-600 p-1 px-4 text-sm text-rose-100 shadow-sm hover:cursor-pointer"
                  rel="noopener noreferrer"
                >
                  <X
                    size={15}
                    className="font-bold text-rose-200"
                  />
                  <p>{t('deleteChapter')}</p>
                </div>
              }
              functionToExecute={() => props.deleteChapter(props.info.list.chapter.id)}
              status="warning"
            />
          </div>
          <Droppable
            key={props.info.list.chapter.id}
            droppableId={String(props.info.list.chapter.id)}
            type="activity"
          >
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="p-2.5"
              >
                <div className="flex flex-col">
                  {props.info.list.activities.map((activity: any, index: any) => (
                    <Activity
                      orgslug={props.orgslug}
                      courseid={props.courseid}
                      key={activity.id}
                      activity={activity}
                      index={index}
                    />
                  ))}
                  {provided.placeholder}

                  <div
                    onClick={() => {
                      props.openNewActivityModal(props.info.list.chapter.id);
                    }}
                    className="my-3 flex items-center justify-center space-x-2 rounded-md bg-black py-5 text-white hover:cursor-pointer"
                  >
                    <Sparkles
                      className=""
                      size={17}
                    />
                    <div className="mx-auto my-auto items-center text-sm font-bold">{t('addActivityButton')} + </div>
                  </div>
                </div>
              </div>
            )}
          </Droppable>
        </div>
      )}
    </Draggable>
  );
}

export default Chapter;
