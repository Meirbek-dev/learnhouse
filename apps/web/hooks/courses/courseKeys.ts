'use client';

import { getAPIUrl } from '@services/config/config';

const normalizeCourseUuid = (courseUuid: string) =>
  courseUuid.startsWith('course_') ? courseUuid : `course_${courseUuid}`;

export interface CourseListKeyOptions {
  page?: number;
  limit?: number;
  query?: string;
  sortBy?: string;
  preset?: string;
}

const buildQueryString = (params: Record<string, string | number | undefined>) => {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const courseKeys = {
  list: ({ page = 1, limit = 20, query, sortBy, preset }: CourseListKeyOptions = {}) =>
    `${getAPIUrl()}courses/page/${page}/limit/${limit}${buildQueryString({ query, sort_by: sortBy, preset })}`,

  editable: ({ page = 1, limit = 20, query, sortBy = 'updated', preset }: CourseListKeyOptions = {}) =>
    `${getAPIUrl()}courses/editable/page/${page}/limit/${limit}${buildQueryString({ query, sort_by: sortBy, preset })}`,

  detail: (courseUuid: string) => `${getAPIUrl()}courses/${normalizeCourseUuid(courseUuid)}`,

  structure: (courseUuid: string, withUnpublishedActivities = false) =>
    `${getAPIUrl()}courses/${normalizeCourseUuid(courseUuid)}/meta?with_unpublished_activities=${withUnpublishedActivities}`,

  rights: (courseUuid: string) => `${getAPIUrl()}courses/${normalizeCourseUuid(courseUuid)}/rights`,

  contributors: (courseUuid: string) => `${getAPIUrl()}courses/${normalizeCourseUuid(courseUuid)}/contributors`,

  // Token removed from key — fetcher injects it via global SWRConfig.
  editorBundle: (courseUuid?: string | null) =>
    courseUuid ? (['course-editor-bundle', normalizeCourseUuid(courseUuid)] as const) : null,

  chapter: (chapterUuid: string) => `${getAPIUrl()}chapters/${chapterUuid}`,

  activity: (activityUuid: string) => `${getAPIUrl()}activities/${activityUuid}`,
};

export { normalizeCourseUuid };
