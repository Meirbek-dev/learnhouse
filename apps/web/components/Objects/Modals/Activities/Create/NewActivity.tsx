'use client'
import { useState } from 'react'
import DynamicPageActivityImage from 'public/activities_types/dynamic-page-activity.png'
import VideoPageActivityImage from 'public//activities_types/video-page-activity.png'
import DocumentPdfPageActivityImage from 'public//activities_types/documentpdf-page-activity.png'
import AssignmentActivityImage from 'public//activities_types/assignment-page-activity.png'

import DynamicCanvaModal from './NewActivityModal/DynamicCanva'
import VideoModal from './NewActivityModal/Video'
import Image from 'next/image'
import DocumentPdfModal from './NewActivityModal/DocumentPdf'
import Assignment from './NewActivityModal/Assignment'
import { useTranslations } from 'next-intl'

function NewActivityModal({
  closeModal,
  submitActivity,
  submitFileActivity,
  submitExternalVideo,
  chapterId,
  course,
}: any) {
  const t = useTranslations('Components.NewActivity')
  const [selectedView, setSelectedView] = useState('home')

  return (
    <>
      {selectedView === 'home' && (
        <div className="mt-2.5 grid w-full grid-cols-4 gap-2">
          <ActivityOption
            onClick={() => {
              setSelectedView('dynamic')
            }}
          >
            <div className="m-0.5 flex h-20 flex-col items-center justify-end rounded-lg bg-white text-center hover:cursor-pointer">
              <Image
                unoptimized
                quality={100}
                alt={t('dynamicPage')}
                src={DynamicPageActivityImage}
              ></Image>
            </div>
            <div className="flex h-5 items-center justify-center text-center text-sm font-medium text-gray-500">
              {t('dynamicPage')}
            </div>
          </ActivityOption>
          <ActivityOption
            onClick={() => {
              setSelectedView('video')
            }}
          >
            <div className="m-0.5 flex h-20 flex-col items-center justify-end rounded-lg bg-white text-center hover:cursor-pointer">
              <Image
                unoptimized
                quality={100}
                alt={t('video')}
                src={VideoPageActivityImage}
              ></Image>
            </div>
            <div className="flex h-5 items-center justify-center text-center text-sm font-medium text-gray-500">
              {t('video')}
            </div>
          </ActivityOption>
          <ActivityOption
            onClick={() => {
              setSelectedView('documentpdf')
            }}
          >
            <div className="m-0.5 flex h-20 flex-col items-center justify-end rounded-lg bg-white text-center hover:cursor-pointer">
              <Image
                unoptimized
                quality={100}
                alt={t('document')}
                src={DocumentPdfPageActivityImage}
              ></Image>
            </div>
            <div className="flex h-5 items-center justify-center text-center text-sm font-medium text-gray-500">
              {t('document')}
            </div>
          </ActivityOption>
          <ActivityOption
            onClick={() => {
              setSelectedView('assignments')
            }}
          >
            <div className="m-0.5 flex h-20 flex-col items-center justify-end rounded-lg bg-white text-center hover:cursor-pointer">
              <Image
                unoptimized
                quality={100}
                alt={t('assignments')}
                src={AssignmentActivityImage}
              ></Image>
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
        />
      )}
    </>
  )
}

const ActivityOption = ({ onClick, children }: any) => (
  <div
    onClick={onClick}
    className="mx-auto w-full cursor-pointer rounded-xl border-4 border-gray-100 bg-gray-100 text-center transition duration-200 ease-in-out hover:border-gray-200 hover:bg-gray-200"
  >
    {children}
  </div>
)

export default NewActivityModal
