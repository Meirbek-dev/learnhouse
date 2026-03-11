'use client';

import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { createContext, use, useEffect, useReducer } from 'react';
import ErrorUI from '@/components/Objects/Elements/Error/Error';
import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import useSWR from 'swr';

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

// Action types for the reducer
type CourseAction =
  | { type: 'setCourseStructure'; payload: CourseStructure }
  | { type: 'setIsLoaded' }
  | { type: 'setSectionDirty'; payload: { section: CourseSectionKey; dirty: boolean } }
  | { type: 'clearDirtySections' };

// Course state interface
interface CourseState {
  courseStructure: CourseStructure;
  isLoading: boolean;
  withUnpublishedActivities: boolean;
  dirtySections: Partial<Record<CourseSectionKey, boolean>>;
}

// Course provider props interface
interface CourseProviderProps {
  children: ReactNode;
  courseuuid: string;
  withUnpublishedActivities?: boolean;
  initialCourse?: CourseStructure | null;
}

// Dispatch type
type CourseDispatch = React.Dispatch<CourseAction>;

export const CourseContext = createContext<CourseState | null>(null);
export const CourseDispatchContext = createContext<CourseDispatch | null>(null);

export const CourseProvider = ({
  children,
  courseuuid,
  withUnpublishedActivities = false,
  initialCourse,
}: CourseProviderProps) => {
  const session = usePlatformSession();
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('Contexts.Course');

  const {
    data: courseStructureData,
    error,
    isLoading: isSWRLoading,
  } = useSWR<CourseStructure>(
    `${getAPIUrl()}courses/${courseuuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
    (url: string) => swrFetcher(url, access_token),
    {
      fallbackData: initialCourse || undefined,
      revalidateOnMount: !initialCourse,
      revalidateIfStale: !initialCourse,
    },
  );

  const initialState: CourseState = {
    courseStructure: {
      ...(initialCourse || {}),
      course_uuid: initialCourse?.course_uuid || courseuuid,
      chapters: initialCourse?.chapters || [],
    },
    isLoading: !initialCourse,
    withUnpublishedActivities,
    dirtySections: {},
  };

  const [state, dispatch] = useReducer(courseReducer, initialState);

  useEffect(() => {
    if (courseStructureData) {
      dispatch({ type: 'setCourseStructure', payload: courseStructureData });
      dispatch({ type: 'setIsLoaded' });
    }
  }, [courseStructureData]);

  const isLoading = isSWRLoading || state.isLoading;

  if (error) return <ErrorUI message={t('loadError')} />;
  if (isLoading) return <PageLoading />;

  if (courseStructureData) {
    return (
      <CourseContext.Provider value={state}>
        <CourseDispatchContext.Provider value={dispatch}>{children}</CourseDispatchContext.Provider>
      </CourseContext.Provider>
    );
  }

  return null;
};

export function useCourse(): CourseState {
  const context = use(CourseContext);
  if (!context) {
    throw new Error('useCourse must be used within a CourseProvider');
  }
  return context;
}

export function useCourseDispatch(): CourseDispatch {
  const context = use(CourseDispatchContext);
  if (!context) {
    throw new Error('useCourseDispatch must be used within a CourseProvider');
  }
  return context;
}

function courseReducer(state: CourseState, action: CourseAction): CourseState {
  switch (action.type) {
    case 'setCourseStructure': {
      return { ...state, courseStructure: action.payload };
    }
    case 'setIsLoaded': {
      return { ...state, isLoading: false };
    }
    case 'setSectionDirty': {
      return {
        ...state,
        dirtySections: {
          ...state.dirtySections,
          [action.payload.section]: action.payload.dirty,
        },
      };
    }
    case 'clearDirtySections': {
      return { ...state, dirtySections: {} };
    }
    default: {
      const _exhaustiveCheck: never = action;
      throw new Error(`Unhandled action type: ${_exhaustiveCheck}`);
    }
  }
}
