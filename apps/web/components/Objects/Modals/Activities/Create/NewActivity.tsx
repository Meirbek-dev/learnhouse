'use client';

import {
  Code2,
  FileText,
  ClipboardList,
  GraduationCap,
  Video,
  Sparkles,
  ArrowLeft,
  type LucideIcon,
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';

import CodeChallenge from './NewActivityModal/CodeChallengeActivityModal';
import DocumentPdfModal from './NewActivityModal/DocumentActivityModal';
import DynamicCanvaModal from './NewActivityModal/DynamicActivityModal';
import Assignment from './NewActivityModal/AssignmentActivityModal';
import VideoModal from './NewActivityModal/VideoActivityModal';
import Exam from './NewActivityModal/ExamActivityModal';

type ViewType = 'home' | 'dynamic' | 'video' | 'documentpdf' | 'assignments' | 'exams' | 'codechallenge';

interface ActivityType {
  id: ViewType;
  labelKey: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

interface NewActivityModalProps {
  closeModal: () => void;
  submitActivity: (data?: any) => Promise<void>;
  submitFileActivity: (file: any, type: any, activity: any, chapterId: number) => Promise<void>;
  submitExternalVideo: (external_video_data: any, activity: any, chapterId: number) => Promise<void>;
  chapterId: number;
  course: unknown;
  orgslug: string;
}

const ACTIVITY_TYPES: ActivityType[] = [
  {
    id: 'dynamic',
    labelKey: 'dynamicPage',
    icon: Sparkles,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 group-hover:bg-purple-100',
  },
  {
    id: 'video',
    labelKey: 'video',
    icon: Video,
    color: 'text-red-600',
    bgColor: 'bg-red-50 group-hover:bg-red-100',
  },
  {
    id: 'documentpdf',
    labelKey: 'document',
    icon: FileText,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 group-hover:bg-blue-100',
  },
  {
    id: 'assignments',
    labelKey: 'assignments',
    icon: ClipboardList,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 group-hover:bg-amber-100',
  },
  {
    id: 'exams',
    labelKey: 'exams',
    icon: GraduationCap,
    color: 'text-green-600',
    bgColor: 'bg-green-50 group-hover:bg-green-100',
  },
  {
    id: 'codechallenge',
    labelKey: 'codeChallenge',
    icon: Code2,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50 group-hover:bg-cyan-100',
  },
];

export default function NewActivityModal({
  closeModal,
  submitActivity,
  submitFileActivity,
  submitExternalVideo,
  chapterId,
  course,
  orgslug,
}: NewActivityModalProps) {
  const t = useTranslations('Components.NewActivity');
  const [selectedView, setSelectedView] = useState<ViewType>('home');

  const handleBack = useCallback(() => setSelectedView('home'), []);

  const sharedProps = {
    chapterId,
    course,
    closeModal,
    orgslug,
  };

  if (selectedView === 'home') {
    return (
      <div className="grid w-full grid-cols-2 gap-3 p-2 sm:grid-cols-3 lg:grid-cols-6">
        {ACTIVITY_TYPES.map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            label={t(activity.labelKey)}
            onClick={() => setSelectedView(activity.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full">
      <button
        onClick={handleBack}
        className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToActivities')}
      </button>

      {selectedView === 'dynamic' && (
        <DynamicCanvaModal
          submitActivity={submitActivity}
          {...sharedProps}
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
          {...sharedProps}
        />
      )}

      {selectedView === 'exams' && (
        <Exam
          submitActivity={submitActivity}
          {...sharedProps}
        />
      )}

      {selectedView === 'codechallenge' && (
        <CodeChallenge
          submitActivity={submitActivity}
          {...sharedProps}
        />
      )}
    </div>
  );
}

interface ActivityCardProps {
  activity: ActivityType;
  label: string;
  onClick: () => void;
}

function ActivityCard({ activity, label, onClick }: ActivityCardProps) {
  const Icon = activity.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group focus:ring-primary/50 flex w-full flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md focus:ring-2 focus:outline-none"
    >
      <div className={`flex h-14 w-14 items-center justify-center rounded-xl transition-colors ${activity.bgColor}`}>
        <Icon className={`h-7 w-7 ${activity.color}`} />
      </div>
      <span className="text-center text-base font-medium text-gray-700 group-hover:text-gray-900">{label}</span>
    </button>
  );
}
