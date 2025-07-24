'use client';

import ErrorUI from '@components/Objects/StyledElements/Error/Error';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { createContext, use, useEffect, useReducer } from 'react';
import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';

type CourseDispatch = React.Dispatch<any>;
interface CourseState {
  courseStructure: any;
  courseOrder: any;
  isSaved: boolean;
  isLoading: boolean;
  withUnpublishedActivities: boolean;
}

export const CourseContext = createContext<CourseState | null>(null);
export const CourseDispatchContext = createContext<CourseDispatch | null>(null);

export const CourseProvider = ({ children, courseuuid, withUnpublishedActivities = false }: any) => {
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('Contexts.Course');

  const {
    data: courseStructureData,
    error,
    isLoading: isSWRLoading,
  } = useSWR(
    `${getAPIUrl()}courses/${courseuuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
    (url) => swrFetcher(url, access_token),
  );

  const initialState = {
    courseStructure: {
      course_uuid: courseuuid,
    },
    courseOrder: {},
    isSaved: true,
    isLoading: true,
    withUnpublishedActivities,
  };

  const [state, dispatch] = useReducer(courseReducer, initialState) as any;

  useEffect(() => {
    if (courseStructureData) {
      dispatch({ type: 'setCourseStructure', payload: courseStructureData });
      dispatch({ type: 'setIsLoaded' });
    }
  }, [courseStructureData, dispatch]);

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
};

export function useCourse() {
  const context = use(CourseContext);
  if (!context) {
    throw new Error('useCourse must be used within a CourseProvider');
  }
  return context;
}

export function useCourseDispatch() {
  const context = use(CourseDispatchContext);
  if (!context) {
    throw new Error('useCourseDispatch must be used within a CourseProvider');
  }
  return context;
}

function courseReducer(state: any, action: any) {
  switch (action.type) {
    case 'setCourseStructure':
      return { ...state, courseStructure: action.payload };
    case 'setCourseOrder':
      return { ...state, courseOrder: action.payload };
    case 'setIsSaved':
      return { ...state, isSaved: true };
    case 'setIsNotSaved':
      return { ...state, isSaved: false };
    case 'setIsLoaded':
      return { ...state, isLoading: false };
    default:
      throw new Error(`Unhandled action type: ${action.type}`);
  }
}
