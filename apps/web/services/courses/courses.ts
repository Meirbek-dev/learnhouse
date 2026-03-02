'use server';
import {
  RequestBodyFormWithAuthHeader,
  RequestBodyWithAuthHeader,
  errorHandling,
  getResponseMetadata,
} from '@services/utils/ts/requests';
import { CacheProfiles, cacheLife, cacheTag } from '@/lib/cache';
import { getAPIUrl } from '@services/config/config';
import { tags } from '@/lib/cacheTags';

/*
 This file includes POST, PUT, DELETE requests and cached GET requests
 Client-side GET requests are called from the frontend using SWR
*/

/**
 * Cached fetch for organization courses
 * Uses `use cache` directive for cacheComponents
 * Returns both courses and total count for pagination
 */
async function fetchOrgCourses(
  org_slug: string,
  page = 1,
  limit = 20,
  access_token?: string,
): Promise<{ courses: any[]; total: number }> {
  'use cache';
  cacheTag(tags.courses);
  cacheLife(CacheProfiles.courses);

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (access_token) {
    headers.Authorization = `Bearer ${access_token}`;
  }

  const result = await fetch(`${getAPIUrl()}courses/org_slug/${org_slug}/page/${page}/limit/${limit}`, {
    method: 'GET',
    headers,
  });

  if (!result.ok) {
    const error: any = new Error(result.statusText || 'Request failed');
    error.status = result.status;
    throw error;
  }

  const courses = await result.json();
  const total = Number.parseInt(result.headers.get('X-Total-Count') ?? '0', 10);

  return { courses, total };
}

export async function getOrgCourses(org_slug: string, _next?: any, access_token?: any, page = 1, limit = 20) {
  return fetchOrgCourses(org_slug, page, limit, access_token);
}

/**
 * Cached fetch for courses the current user can edit in an org
 */
async function fetchEditableOrgCourses(
  org_slug: string,
  page = 1,
  limit = 20,
  access_token?: string,
): Promise<{ courses: any[]; total: number }> {
  'use cache';
  cacheTag(tags.editableCourses);
  cacheLife(CacheProfiles.courses);

  if (!access_token) {
    return { courses: [], total: 0 };
  }

  const result = await fetch(`${getAPIUrl()}courses/org_slug/${org_slug}/editable/page/${page}/limit/${limit}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`,
    },
  });

  if (!result.ok) {
    const error: any = new Error(result.statusText || 'Request failed');
    error.status = result.status;
    throw error;
  }

  const courses = await result.json();
  const total = Number.parseInt(result.headers.get('X-Total-Count') ?? '0', 10);

  return { courses, total };
}

export async function getEditableOrgCourses(org_slug: string, access_token?: any, page = 1, limit = 20) {
  return fetchEditableOrgCourses(org_slug, page, limit, access_token);
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

/**
 * Cached fetch for course metadata
 */
async function fetchCourseMetadata(course_uuid: string, access_token?: string) {
  'use cache';
  cacheTag(tags.courses);
  cacheLife(CacheProfiles.courses);

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (access_token) {
    headers.Authorization = `Bearer ${access_token}`;
  }

  const result = await fetch(`${getAPIUrl()}courses/course_${course_uuid}/meta`, {
    method: 'GET',
    headers,
  });
  return await errorHandling(result);
}

export async function getCourseMetadata(course_uuid: string, _next?: any, access_token?: string | null) {
  return fetchCourseMetadata(course_uuid, access_token || undefined);
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
  const data_result = await errorHandling(result);

  // Revalidate course cache after update
  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
    revalidateTag(tags.editableCourses, 'max');
  }

  return data_result;
}

/**
 * Cached fetch for full course data
 */
async function fetchCourse(course_uuid: string, access_token: string) {
  'use cache';
  cacheTag(tags.courses);
  cacheLife(CacheProfiles.courses);

  const result = await fetch(`${getAPIUrl()}courses/${course_uuid}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`,
    },
  });
  return await errorHandling(result);
}

export async function getCourse(course_uuid: string, _next?: any, access_token?: string) {
  if (!access_token) {
    throw new Error('Access token required');
  }
  return fetchCourse(course_uuid, access_token);
}

/**
 * Cached fetch for course by ID
 */
async function fetchCourseById(course_id: number, access_token: string) {
  'use cache';
  cacheTag(tags.courses);
  cacheLife(CacheProfiles.courses);

  const result = await fetch(`${getAPIUrl()}courses/id/${course_id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`,
    },
  });
  return await errorHandling(result);
}

export async function getCourseById(course_id: number, _next?: any, access_token?: string) {
  if (!access_token) {
    throw new Error('Access token required');
  }
  return fetchCourseById(course_id, access_token);
}

export async function updateCourseThumbnail(course_uuid: string, formData: FormData, access_token: string) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/thumbnail`,
    RequestBodyFormWithAuthHeader('PUT', formData, null, access_token),
  );
  const metadata = await getResponseMetadata(result);

  // Revalidate course cache after thumbnail update
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
    revalidateTag(tags.editableCourses, 'max');
  }

  return metadata;
}

export async function createNewCourse(org_id: number, course_body: any, thumbnail: any, access_token: string) {
  // Send file thumbnail as form data
  const formData = new FormData();
  formData.append('name', course_body.name);
  formData.append('description', course_body.description || '');
  formData.append('public', course_body.visibility);
  formData.append('learnings', course_body.learnings || '');
  formData.append('tags', course_body.tags || '');
  formData.append('about', course_body.description || '');

  if (thumbnail) {
    formData.append('thumbnail', thumbnail);
  }

  const result = await fetch(
    `${getAPIUrl()}courses?org_id=${org_id}`,
    RequestBodyFormWithAuthHeader('POST', formData, null, access_token),
  );
  const metadata = await getResponseMetadata(result);

  // Revalidate course cache after creating new course
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
    revalidateTag(tags.editableCourses, 'max');
  }

  return metadata;
}

export async function deleteCourseFromBackend(course_uuid: string, access_token: string) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token),
  );
  const data_result = await errorHandling(result);

  // Revalidate course cache after deletion
  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
    revalidateTag(tags.editableCourses, 'max');
  }

  return data_result;
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
  const metadata = await getResponseMetadata(result);

  // Revalidate courses cache after editing contributor
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
    revalidateTag(tags.editableCourses, 'max');
  }

  return metadata;
}

export async function applyForContributor(course_uuid: string, data: any, access_token: string | null | undefined) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/apply-contributor`,
    RequestBodyWithAuthHeader('POST', data, null, access_token || undefined),
  );
  const metadata = await getResponseMetadata(result);

  // Revalidate courses cache after applying for contributor
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
  }

  return metadata;
}

export async function bulkAddContributors(course_uuid: string, data: any, access_token: string | null | undefined) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/bulk-add-contributors`,
    RequestBodyWithAuthHeader('POST', data, null, access_token || undefined),
  );
  const metadata = await getResponseMetadata(result);

  // Revalidate courses cache after bulk adding contributors
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
    revalidateTag(tags.editableCourses, 'max');
  }

  return metadata;
}

export async function bulkRemoveContributors(course_uuid: string, data: any, access_token: string | null | undefined) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/bulk-remove-contributors`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token || undefined),
  );
  const data_result = await errorHandling(result);

  // Revalidate courses cache after bulk removing contributors
  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
    revalidateTag(tags.editableCourses, 'max');
  }

  return data_result;
}

export async function getCourseRights(course_uuid: string, access_token: string | null | undefined) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/rights`,
    RequestBodyWithAuthHeader('GET', null, null, access_token || undefined),
  );
  return await errorHandling(result);
}
