'use client'
import { getAPIUrl } from '@services/config/config'
import { swrFetcher } from '@services/utils/ts/requests'
import { createContext, use, useEffect, useReducer } from 'react'
import useSWR from 'swr'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import ErrorUI from '@components/Objects/StyledElements/Error/Error'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import { useTranslations } from 'next-intl'

type CourseDispatch = React.Dispatch<any>
type CourseState = {
  courseStructure: any
  courseOrder: any
  isSaved: boolean
  isLoading: boolean
  withUnpublishedActivities: boolean
}

export const CourseContext = createContext<CourseState | null>(null)
export const CourseDispatchContext = createContext<CourseDispatch | null>(null)

export function CourseProvider({
  children,
  courseuuid,
  withUnpublishedActivities = false,
}: any) {
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const t = useTranslations('Contexts.Course')

  const {
    data: courseStructureData,
    error,
    isLoading: isSWRLoading,
  } = useSWR(
    `${getAPIUrl()}courses/${courseuuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
    (url) => swrFetcher(url, access_token)
  )

  const initialState = {
    courseStructure: {
      course_uuid: courseuuid,
    },
    courseOrder: {},
    isSaved: true,
    isLoading: true,
    withUnpublishedActivities: withUnpublishedActivities,
  }

  const [state, dispatch] = useReducer(courseReducer, initialState) as any

  useEffect(() => {
    if (courseStructureData) {
      dispatch({ type: 'setCourseStructure', payload: courseStructureData })
      dispatch({ type: 'setIsLoaded' })
    }
  }, [courseStructureData])

  const isLoading = isSWRLoading || state.isLoading

  if (error) return <ErrorUI message={t('loadError')} />
  if (isLoading) return <PageLoading />

  if (courseStructureData) {
    return (
      <CourseContext value={state}>
        <CourseDispatchContext value={dispatch}>
          {children}
        </CourseDispatchContext>
      </CourseContext>
    )
  }
}

export function useCourse() {
  return use(CourseContext)
}

export function useCourseDispatch() {
  return use(CourseDispatchContext)
}

function courseReducer(state: any, action: any) {
  switch (action.type) {
    case 'setCourseStructure':
      return { ...state, courseStructure: action.payload }
    case 'setCourseOrder':
      return { ...state, courseOrder: action.payload }
    case 'setIsSaved':
      return { ...state, isSaved: true }
    case 'setIsNotSaved':
      return { ...state, isSaved: false }
    case 'setIsLoaded':
      return { ...state, isLoading: false }
    default:
      throw new Error(`Unhandled action type: ${action.type}`)
  }
}
