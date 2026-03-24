'use client';

import { useCourseEditorBundle } from '@/hooks/courses/useCourseEditorBundle';
import { createEmptyCourseEditorBundle } from '@services/courses/editor';
import { createContext, use, useCallback, useEffect, useMemo } from 'react';
import { useCourseStructure } from '@/hooks/courses/useCourseStructure';
import { getCourseReadinessSummary } from '@/lib/course-management';
import type { CourseEditorBundle } from '@services/courses/editor';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import ErrorUI from '@/components/Objects/Elements/Error/Error';
import { useCourseEditorStore } from '@/stores/courses';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

export interface Activity {
  id: number;
  activity_uuid: string;
  name?: string;
  activity_type?: string;
  public?: boolean;
  published?: boolean;
  // Backend permission metadata (returned by /courses/{uuid}/meta)
  can_update?: boolean;
  can_delete?: boolean;
  is_owner?: boolean;
  is_creator?: boolean;
  available_actions?: string[];
  [key: string]: any;
}

export interface Chapter {
  id: number;
  chapter_uuid: string;
  name?: string;
  activities?: Activity[];
  [key: string]: any;
}

type Learnings = string | object | null;
export type CourseSectionKey = 'general' | 'access' | 'contributors' | 'certification' | 'content';

// Course structure interface with improved typing
export interface CourseStructure {
  course_uuid: string;
  name?: string;
  description?: string;
  about?: string;
  learnings?: Learnings;
  tags?: string[];
  public?: boolean;
  thumbnail_image?: string;
  thumbnail_type?: 'image' | 'video' | 'both';
  chapters: Chapter[];
  _certificationData?: any;
  [key: string]: any;
}

interface CourseConflictState {
  isOpen: boolean;
  message: string;
}

// Course state interface
interface CourseState {
  courseStructure: CourseStructure;
  isLoading: boolean;
  withUnpublishedActivities: boolean;
  dirtySections: Partial<Record<CourseSectionKey, boolean>>;
  editorData: CourseEditorBundle;
  conflict: CourseConflictState;
}

interface CourseContextValue extends CourseState {
  courseMetaUrl: string;
  isEditorDataLoading: boolean;
  readiness: ReturnType<typeof getCourseReadinessSummary>;
  refreshCourseMeta: () => Promise<CourseStructure | undefined>;
  refreshEditorData: () => Promise<CourseEditorBundle | undefined>;
  refreshCourseEditor: () => Promise<void>;
  dismissConflict: () => void;
}

// Course provider props interface
interface CourseProviderProps {
  children: ReactNode;
  courseuuid: string;
  withUnpublishedActivities?: boolean;
  initialCourse?: CourseStructure | null;
}

export const CourseContext = createContext<CourseContextValue | null>(null);

export const CourseProvider = ({
  children,
  courseuuid,
  withUnpublishedActivities = false,
  initialCourse,
}: CourseProviderProps) => {
  const t = useTranslations('Contexts.Course');
  const openEditor = useCourseEditorStore((state) => state.openEditor);
  const dismissConflict = useCourseEditorStore((state) => state.dismissConflict);
  const dirtySections = useCourseEditorStore((state) => state.dirtySections);
  const conflict = useCourseEditorStore((state) => state.conflict);
  const syncLastKnownUpdateDate = useCourseEditorStore((state) => state.syncLastKnownUpdateDate);

  const {
    courseStructure: courseStructureData,
    error,
    isLoading,
    mutate: mutateCourseMeta,
    key: courseMetaUrl,
  } = useCourseStructure<CourseStructure>(courseuuid, {
    withUnpublishedActivities,
    fallbackData: initialCourse || undefined,
  });

  const {
    editorData: editorBundleData,
    isLoading: isEditorDataLoading,
    mutate: mutateEditorBundle,
  } = useCourseEditorBundle(courseuuid);

  useEffect(() => {
    if (courseStructureData) {
      openEditor(courseuuid, courseStructureData.update_date);
      syncLastKnownUpdateDate(courseStructureData.update_date);
    }
  }, [courseStructureData, courseuuid, openEditor, syncLastKnownUpdateDate]);

  const refreshCourseMeta = useCallback(async () => mutateCourseMeta(), [mutateCourseMeta]);
  const refreshEditorData = useCallback(async () => mutateEditorBundle(), [mutateEditorBundle]);
  const refreshCourseEditor = useCallback(
    async () => void (await Promise.all([mutateCourseMeta(), mutateEditorBundle()])),
    [mutateCourseMeta, mutateEditorBundle],
  );
  const dismissConflictHandler = useCallback(() => dismissConflict(), [dismissConflict]);

  const readiness = useMemo(
    () =>
      getCourseReadinessSummary(
        courseStructureData || {
          ...initialCourse,
          course_uuid: initialCourse?.course_uuid || courseuuid,
          chapters: initialCourse?.chapters || [],
        },
        editorBundleData || createEmptyCourseEditorBundle(),
      ),
    [courseStructureData, courseuuid, editorBundleData, initialCourse],
  );

  if (error) return <ErrorUI message={t('loadError')} />;
  if (isLoading) return <PageLoading />;

  if (courseStructureData) {
    const value: CourseContextValue = {
      courseStructure: courseStructureData,
      isLoading: false,
      withUnpublishedActivities,
      dirtySections,
      editorData: editorBundleData || createEmptyCourseEditorBundle(),
      conflict,
      courseMetaUrl,
      isEditorDataLoading,
      readiness,
      refreshCourseMeta,
      refreshEditorData,
      refreshCourseEditor,
      dismissConflict: dismissConflictHandler,
    };

    return <CourseContext.Provider value={value}>{children}</CourseContext.Provider>;
  }

  return null;
};

export function useCourse(): CourseContextValue {
  const context = use(CourseContext);
  if (!context) {
    throw new Error('useCourse must be used within a CourseProvider');
  }
  return context;
}
