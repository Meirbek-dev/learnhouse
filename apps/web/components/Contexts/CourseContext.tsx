'use client';

import ErrorUI from '@components/Objects/StyledElements/Error/Error';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { createContext, use, useEffect, useReducer } from 'react';
import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import useSWR from 'swr';

interface Activity {
  id: number;
  activity_uuid: string;
  name?: string;
  activity_type?: string;
  public?: boolean;
  [key: string]: any;
}

interface Chapter {
  id: number;
  chapter_uuid: string;
  name?: string;
  activities?: Activity[];
  [key: string]: any;
}

type Learnings = string | object | null;

// Course structure interface with improved typing
interface CourseStructure {
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

// Course order interface
interface CourseOrder {
  chapter_order_by_ids?: {
    chapter_id: number;
    activities_order_by_ids: Array<{
      activity_id: number;
    }>;
  }[];
  [key: string]: any; // For additional properties
}

// Action types for the reducer
type CourseAction =
  | { type: 'setCourseStructure'; payload: CourseStructure }
  | { type: 'setCourseOrder'; payload: CourseOrder }
  | { type: 'setIsSaved' }
  | { type: 'setIsNotSaved' }
  | { type: 'setIsLoaded' };

// Course state interface
interface CourseState {
  courseStructure: CourseStructure;
  courseOrder: CourseOrder;
  isSaved: boolean;
  isLoading: boolean;
  withUnpublishedActivities: boolean;
}

// Course provider props interface
interface CourseProviderProps {
  children: ReactNode;
  courseuuid: string;
  withUnpublishedActivities?: boolean;
}

// Dispatch type
type CourseDispatch = React.Dispatch<CourseAction>;

export const CourseContext = createContext<CourseState | null>(null);
export const CourseDispatchContext = createContext<CourseDispatch | null>(null);

export const CourseProvider = ({ children, courseuuid, withUnpublishedActivities = false }: CourseProviderProps) => {
  const session = useLHSession();
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('Contexts.Course');

  const {
    data: courseStructureData,
    error,
    isLoading: isSWRLoading,
  } = useSWR<CourseStructure>(
    `${getAPIUrl()}courses/${courseuuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
    (url) => swrFetcher(url, access_token),
  );

  const initialState: CourseState = {
    courseStructure: {
      course_uuid: courseuuid,
      chapters: [], // Initialize as empty array to satisfy required type
    },
    courseOrder: {},
    isSaved: true,
    isLoading: true,
    withUnpublishedActivities,
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
    case 'setCourseOrder': {
      return { ...state, courseOrder: action.payload };
    }
    case 'setIsSaved': {
      return { ...state, isSaved: true };
    }
    case 'setIsNotSaved': {
      return { ...state, isSaved: false };
    }
    case 'setIsLoaded': {
      return { ...state, isLoading: false };
    }
    default: {
      const _exhaustiveCheck: never = action;
      throw new Error(`Unhandled action type: ${_exhaustiveCheck}`);
    }
  }
}
