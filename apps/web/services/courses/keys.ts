import { getAPIUrl } from '@services/config/config';

/**
 * SWR key builders for course-related resources
 */
export function getTrailSwrKey(orgId: number | null | undefined) {
  if (!orgId) return '';
  return `${getAPIUrl()}trail/org/${orgId}/trail`;
}

export function getCoursesSwrKey(orgSlug: string, page = 1, limit = 12) {
  if (!orgSlug) return '';
  return `${getAPIUrl()}courses/org_slug/${orgSlug}/page/${page}/limit/${limit}`;
}

export function getCourseUpdatesSwrKey(course_uuid: string | null | undefined) {
  if (!course_uuid) return '';
  return `${getAPIUrl()}courses/${course_uuid}/updates`;
}

export function getCourseMetadataSwrKey(course_uuid: string | null | undefined) {
  if (!course_uuid) return '';
  return `${getAPIUrl()}courses/${course_uuid}`;
}
