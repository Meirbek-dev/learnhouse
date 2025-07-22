'use client';
import DocumentPdfPageActivityImage from 'public//activities_types/documentpdf-page-activity.webp';
import AssignmentActivityImage from 'public//activities_types/assignment-page-activity.webp';
import DynamicPageActivityImage from 'public/activities_types/dynamic-page-activity.webp';
import VideoPageActivityImage from 'public//activities_types/video-page-activity.webp';
import DocumentPdfModal from './NewActivityModal/DocumentActivityModal';
import DynamicCanvaModal from './NewActivityModal/DynamicActivityModal';
import Assignment from './NewActivityModal/AssignmentActivityModal';
import VideoModal from './NewActivityModal/VideoActivityModal';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Image from 'next/image';

function NewActivityModal({
  closeModal,
  submitActivity,
  submitFileActivity,
  submitExternalVideo,
  chapterId,
  course,
  orgslug,
}: any) {
  const t = useTranslations('Components.NewActivity');
  const [selectedView, setSelectedView] = useState('home');

  return (
    <>
      {selectedView === 'home' && (
        <div className="mt-2.5 grid w-full grid-cols-4 gap-2">
          <ActivityOption
            onClick={() => {
              setSelectedView('dynamic');
            }}
          >
            <div className="m-0.5 flex h-20 flex-col items-center justify-end rounded-lg bg-white text-center hover:cursor-pointer">
              <Image
                unoptimized
                quality={100}
                alt={t('dynamicPage')}
                src={DynamicPageActivityImage}
              />
            </div>
            <div className="flex h-5 items-center justify-center text-center text-sm font-medium text-gray-500">
              {t('dynamicPage')}
            </div>
          </ActivityOption>
          <ActivityOption
            onClick={() => {
              setSelectedView('video');
            }}
          >
            <div className="m-0.5 flex h-20 flex-col items-center justify-end rounded-lg bg-white text-center hover:cursor-pointer">
              <Image
                unoptimized
                quality={100}
                alt={t('video')}
                src={VideoPageActivityImage}
              />
            </div>
            <div className="flex h-5 items-center justify-center text-center text-sm font-medium text-gray-500">
              {t('video')}
            </div>
          </ActivityOption>
          <ActivityOption
            onClick={() => {
              setSelectedView('documentpdf');
            }}
          >
            <div className="m-0.5 flex h-20 flex-col items-center justify-end rounded-lg bg-white text-center hover:cursor-pointer">
              <Image
                unoptimized
                quality={100}
                alt={t('document')}
                src={DocumentPdfPageActivityImage}
              />
            </div>
            <div className="flex h-5 items-center justify-center text-center text-sm font-medium text-gray-500">
              {t('document')}
            </div>
          </ActivityOption>
          <ActivityOption
            onClick={() => {
              setSelectedView('assignments');
            }}
          >
            <div className="m-0.5 flex h-20 flex-col items-center justify-end rounded-lg bg-white text-center hover:cursor-pointer">
              <Image
                unoptimized
                quality={100}
                alt={t('assignments')}
                src={AssignmentActivityImage}
              />
            </div>
            <div className="flex h-5 items-center justify-center text-center text-sm font-medium text-gray-500">
              {t('assignments')}
            </div>
          </ActivityOption>
        </div>
      )}

      {selectedView === 'dynamic' && (
        <DynamicCanvaModal
          submitActivity={submitActivity}
          chapterId={chapterId}
          course={course}
        />
      )}

      {selectedView === 'video' && (
        <VideoModal
          submitFileActivity={submitFileActivity}
          submitExternalVideo={submitExternalVideo}
          chapterId={chapterId}
          course={course}
        />
      )}

      {selectedView === 'documentpdf' && (
        <DocumentPdfModal
          submitFileActivity={submitFileActivity}
          chapterId={chapterId}
          course={course}
        />
      )}

      {selectedView === 'assignments' && (
        <Assignment
          submitActivity={submitActivity}
          chapterId={chapterId}
          course={course}
          closeModal={closeModal}
          orgslug={orgslug}
        />
      )}
    </>
  );
}

const ActivityOption = ({ onClick, children }: any) => (
  <div
    onClick={onClick}
    className="mx-auto w-full cursor-pointer rounded-xl border-4 border-gray-100 bg-gray-100 text-center transition duration-200 ease-in-out hover:border-gray-200 hover:bg-gray-200"
  >
    {children}
  </div>
);

export default NewActivityModal;
