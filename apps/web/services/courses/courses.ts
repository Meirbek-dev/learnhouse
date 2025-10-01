import {
  RequestBodyFormWithAuthHeader,
  RequestBodyWithAuthHeader,
  errorHandling,
  getResponseMetadata,
} from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';

/*
 This file includes only POST, PUT, DELETE requests
 GET requests are called from the frontend using SWR (https://swr.vercel.app/)
*/

export async function getOrgCourses(org_slug: string, next: any, access_token?: any) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/org_slug/${org_slug}/page/1/limit/128`,
    RequestBodyWithAuthHeader('GET', null, next, access_token),
  );
  return await errorHandling(result);
}

export async function searchOrgCourses(
  org_slug: string,
  query: string,
  page = 1,
  limit = 20,
  next: any,
  access_token?: any,
) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/org_slug/${org_slug}/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
    RequestBodyWithAuthHeader('GET', null, next, access_token),
  );
  return await errorHandling(result);
}

export async function getCourseMetadata(course_uuid: string, next: any, access_token: string | null | undefined) {
  const result = await fetch(
    `${getAPIUrl()}courses/course_${course_uuid}/meta`,
    RequestBodyWithAuthHeader('GET', null, next, access_token || undefined),
  );
  return await errorHandling(result);
}

export async function updateCourse(course_uuid: string, data: any, access_token: string) {
  // Transform frontend data format to API format
  const apiData = {
    ...data,
    // API expects tags as comma-separated string, frontend uses array
    tags: Array.isArray(data.tags) ? data.tags.join(', ') : data.tags,
  };

  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}`,
    RequestBodyWithAuthHeader('PUT', apiData, null, access_token),
  );
  return await errorHandling(result);
}

export async function getCourse(course_uuid: string, next: any, access_token: string) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}`,
    RequestBodyWithAuthHeader('GET', null, next, access_token),
  );
  return await errorHandling(result);
}

export async function getCourseById(course_id: number, next: any, access_token: string) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/id/${course_id}`,
    RequestBodyWithAuthHeader('GET', null, next, access_token),
  );
  return await errorHandling(result);
}

export async function updateCourseThumbnail(course_uuid: string, formData: FormData, access_token: string) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/thumbnail`,
    RequestBodyFormWithAuthHeader('PUT', formData, null, access_token),
  );
  return await getResponseMetadata(result);
}

export async function createNewCourse(org_id: number, course_body: any, thumbnail: any, access_token: string) {
  // Send file thumbnail as form data
  const formData = new FormData();
  formData.append('name', course_body.name);
  formData.append('description', course_body.description);
  formData.append('public', course_body.visibility);
  formData.append('learnings', course_body.learnings);
  formData.append('tags', course_body.tags);
  formData.append('about', course_body.description);

  if (thumbnail) {
    formData.append('thumbnail', thumbnail);
  }

  const result = await fetch(
    `${getAPIUrl()}courses/?org_id=${org_id}`,
    RequestBodyFormWithAuthHeader('POST', formData, null, access_token),
  );
  return await getResponseMetadata(result);
}

export async function deleteCourseFromBackend(course_uuid: string, access_token: string) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token),
  );
  return await errorHandling(result);
}

export async function getCourseContributors(course_uuid: string, access_token: string | null | undefined) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/contributors`,
    RequestBodyWithAuthHeader('GET', null, null, access_token || undefined),
  );
  return await getResponseMetadata(result);
}

export async function editContributor(
  course_uuid: string,
  contributor_id: number,
  authorship: any,
  authorship_status: any,
  access_token: string | null | undefined,
) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/contributors/${contributor_id}?authorship=${authorship}&authorship_status=${authorship_status}`,
    RequestBodyWithAuthHeader('PUT', null, null, access_token || undefined),
  );
  return await getResponseMetadata(result);
}

export async function applyForContributor(course_uuid: string, data: any, access_token: string | null | undefined) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/apply-contributor`,
    RequestBodyWithAuthHeader('POST', data, null, access_token || undefined),
  );
  return await getResponseMetadata(result);
}

export async function bulkAddContributors(course_uuid: string, data: any, access_token: string | null | undefined) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/bulk-add-contributors`,
    RequestBodyWithAuthHeader('POST', data, null, access_token || undefined),
  );
  return await getResponseMetadata(result);
}

export async function bulkRemoveContributors(course_uuid: string, data: any, access_token: string | null | undefined) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/bulk-remove-contributors`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token || undefined),
  );
  return await errorHandling(result);
}

export async function getCourseRights(course_uuid: string, access_token: string | null | undefined) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/rights`,
    RequestBodyWithAuthHeader('GET', null, null, access_token || undefined),
  );
  return await errorHandling(result);
}
