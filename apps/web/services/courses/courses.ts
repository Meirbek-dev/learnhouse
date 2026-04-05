'use server';

import {
  RequestBodyFormWithAuthHeader,
  RequestBodyWithAuthHeader,
  errorHandling,
  getResponseMetadata,
} from '@services/utils/ts/requests';
import type { CustomResponseTyping } from '@services/utils/ts/requests';
import { CacheProfiles, cacheLife, cacheTag } from '@/lib/cache';
import type { components } from '@/lib/api/generated';
import { getAPIUrl } from '@services/config/config';
import { courseTag, tags } from '@/lib/cacheTags';

/*
 This file includes POST, PUT, DELETE requests and cached GET requests
 Client-side GET requests are called from the frontend using SWR
*/

type CourseRead = components['schemas']['CourseRead'];
type CourseReadWithPermissions = components['schemas']['CourseReadWithPermissions'];
type FullCourseRead = components['schemas']['FullCourseRead'];
type CourseUserRightsResponse = components['schemas']['CourseUserRightsResponse'];
type CourseDetailResponse = components['schemas']['CourseDetailResponse'];
type AuthorWithRole = components['schemas']['AuthorWithRole'];
type NormalizedCourseAuthor = Omit<AuthorWithRole, 'user'> & {
  user: {
    id: number;
    user_uuid: string;
    avatar_image: string;
    first_name: string;
    middle_name?: string;
    last_name: string;
    username: string;
  };
};
type NormalizedCourse = Omit<
  CourseRead,
  'about' | 'authors' | 'description' | 'learnings' | 'tags' | 'thumbnail_image' | 'thumbnail_type' | 'thumbnail_video'
> & {
  about: string;
  authors: NormalizedCourseAuthor[];
  description: string;
  learnings: string;
  mini_description: string;
  tags: string[];
  thumbnail_image: string;
  thumbnail_type?: Exclude<CourseRead['thumbnail_type'], null>;
  thumbnail_video: string;
};
type NormalizedCourseWithPermissions = Omit<
  CourseReadWithPermissions,
  'about' | 'authors' | 'description' | 'learnings' | 'tags' | 'thumbnail_image' | 'thumbnail_type' | 'thumbnail_video'
> & {
  about: string;
  authors: NormalizedCourseAuthor[];
  description: string;
  learnings: string;
  mini_description: string;
  tags: string[];
  thumbnail_image: string;
  thumbnail_type?: Exclude<CourseReadWithPermissions['thumbnail_type'], null>;
  thumbnail_video: string;
};
type NormalizedFullCourse = Omit<
  FullCourseRead,
  | 'about'
  | 'authors'
  | 'chapters'
  | 'course_uuid'
  | 'creation_date'
  | 'description'
  | 'learnings'
  | 'tags'
  | 'thumbnail_image'
  | 'thumbnail_type'
  | 'thumbnail_video'
  | 'update_date'
> & {
  about: string;
  authors: NormalizedCourseAuthor[];
  chapters: NonNullable<FullCourseRead['chapters']>;
  course_uuid: string;
  creation_date?: string;
  description: string;
  learnings: string;
  mini_description: string;
  tags: string[];
  thumbnail_image: string;
  thumbnail_type?: Exclude<FullCourseRead['thumbnail_type'], null>;
  thumbnail_video: string;
  update_date?: string;
};

type ResponseMetadata<T> = Omit<CustomResponseTyping, 'data'> & {
  data: T | null;
};

interface EditableCoursesSummary {
  total: number;
  ready: number;
  private: number;
  attention: number;
}

async function getTypedResponseMetadata<T>(response: Response): Promise<ResponseMetadata<T>> {
  return (await getResponseMetadata(response)) as ResponseMetadata<T>;
}

function normalizeTags(tags: string | null | undefined): string[] {
  if (!tags) {
    return [];
  }

  try {
    const parsed = JSON.parse(tags);
    if (Array.isArray(parsed)) {
      return parsed.filter((tag): tag is string => typeof tag === 'string');
    }
  } catch {
    // Fall back to treating the stored value as a comma-delimited string.
  }

  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeAuthors(authors: AuthorWithRole[] | undefined): NormalizedCourseAuthor[] {
  return (authors ?? []).map((author) =>
    Object.assign(author, {
      user: {
        ...author.user,
        avatar_image: author.user.avatar_image ?? ``,
        first_name: author.user.first_name ?? ``,
        last_name: author.user.last_name ?? ``,
        middle_name: author.user.middle_name ?? undefined,
        user_uuid: author.user.user_uuid ?? ``,
      },
    }),
  );
}

function normalizeCourse(course: CourseRead): NormalizedCourse {
  return {
    ...course,
    about: course.about ?? '',
    authors: normalizeAuthors(course.authors),
    description: course.description ?? '',
    learnings: course.learnings ?? '',
    mini_description: course.description ?? '',
    tags: normalizeTags(course.tags),
    thumbnail_image: course.thumbnail_image ?? '',
    thumbnail_type: course.thumbnail_type ?? undefined,
    thumbnail_video: course.thumbnail_video ?? '',
  };
}

function normalizeCourseWithPermissions(course: CourseReadWithPermissions): NormalizedCourseWithPermissions {
  return {
    ...course,
    about: course.about ?? '',
    authors: normalizeAuthors(course.authors),
    description: course.description ?? '',
    learnings: course.learnings ?? '',
    mini_description: course.description ?? '',
    tags: normalizeTags(course.tags),
    thumbnail_image: course.thumbnail_image ?? '',
    thumbnail_type: course.thumbnail_type ?? undefined,
    thumbnail_video: course.thumbnail_video ?? '',
  };
}

function normalizeFullCourse(course: FullCourseRead): NormalizedFullCourse {
  return {
    ...course,
    about: course.about ?? '',
    authors: normalizeAuthors(course.authors),
    chapters: course.chapters ?? [],
    course_uuid: course.course_uuid ?? '',
    creation_date: course.creation_date ?? undefined,
    description: course.description ?? '',
    learnings: course.learnings ?? '',
    mini_description: course.description ?? '',
    tags: normalizeTags(course.tags),
    thumbnail_image: course.thumbnail_image ?? '',
    thumbnail_type: course.thumbnail_type ?? undefined,
    thumbnail_video: course.thumbnail_video ?? '',
    update_date: course.update_date ?? undefined,
  };
}

/**
 * Cached fetch for courses
 * Uses `use cache` directive for cacheComponents
 * Returns both courses and total count for pagination
 */
async function fetchCourses(
  page = 1,
  limit = 20,
  access_token?: string,
): Promise<{ courses: NormalizedCourseWithPermissions[]; total: number }> {
  'use cache';
  cacheTag(tags.courses);
  cacheTag(courseTag.publicList());
  cacheLife(CacheProfiles.courses);

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (access_token) {
    headers.Authorization = `Bearer ${access_token}`;
  }

  const result = await fetch(`${getAPIUrl()}courses/page/${page}/limit/${limit}`, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(10_000),
  });

  if (!result.ok) {
    const error: any = new Error(result.statusText || 'Request failed');
    error.status = result.status;
    throw error;
  }

  const courses = ((await result.json()) as CourseReadWithPermissions[]).map((course) =>
    normalizeCourseWithPermissions(course),
  );
  const total = Number.parseInt(result.headers.get('X-Total-Count') ?? '0', 10);

  return { courses, total };
}

export async function getCourses(_next?: any, access_token?: any, page = 1, limit = 20) {
  return fetchCourses(page, limit, access_token);
}

/**
 * Cached fetch for courses the current user can edit
 */
async function fetchEditableCourses(
  page = 1,
  limit = 20,
  access_token?: string,
  query = '',
  sortBy = 'updated',
  preset = '',
): Promise<{
  courses: NormalizedCourseWithPermissions[];
  total: number;
  summary: EditableCoursesSummary;
}> {
  'use cache';
  cacheTag(tags.editableCourses);
  cacheTag(courseTag.editableList());
  cacheLife(CacheProfiles.courses);

  if (!access_token) {
    return {
      courses: [],
      total: 0,
      summary: { total: 0, ready: 0, private: 0, attention: 0 },
    };
  }

  const queryParams = new URLSearchParams();
  if (query?.trim()) {
    queryParams.set('query', query.trim());
  }
  if (sortBy) {
    queryParams.set('sort_by', sortBy);
  }
  if (preset?.trim()) {
    queryParams.set('preset', preset.trim());
  }

  const result = await fetch(
    `${getAPIUrl()}courses/editable/page/${page}/limit/${limit}${queryParams.size > 0 ? `?${queryParams.toString()}` : ''}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!result.ok) {
    const error: any = new Error(result.statusText || 'Request failed');
    error.status = result.status;
    throw error;
  }

  const courses = ((await result.json()) as CourseReadWithPermissions[]).map((course) =>
    normalizeCourseWithPermissions(course),
  );
  const total = Number.parseInt(result.headers.get('X-Total-Count') ?? '0', 10);
  const summary = {
    total: Number.parseInt(result.headers.get('X-Summary-Total') ?? String(total), 10),
    ready: Number.parseInt(result.headers.get('X-Summary-Ready') ?? '0', 10),
    private: Number.parseInt(result.headers.get('X-Summary-Private') ?? '0', 10),
    attention: Number.parseInt(result.headers.get('X-Summary-Attention') ?? '0', 10),
  };

  return { courses, total, summary };
}

export async function getEditableCourses(
  access_token?: any,
  page = 1,
  limit = 20,
  query = '',
  sortBy = 'updated',
  preset = '',
) {
  return fetchEditableCourses(page, limit, access_token, query, sortBy, preset);
}

export async function getCourseUserRights(course_uuid: string, access_token?: string | null) {
  if (!access_token) {
    throw new Error('Access token required');
  }

  const result = await fetch(`${getAPIUrl()}courses/${course_uuid}/rights`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`,
    },
  });

  return (await errorHandling(result)) as CourseUserRightsResponse;
}

export async function searchCourses(query: string, page = 1, limit = 20, next: any, access_token?: any) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
    RequestBodyWithAuthHeader('GET', null, next, access_token),
  );
  return ((await errorHandling(result)) as CourseRead[]).map((course) => normalizeCourse(course));
}

/**
 * Cached fetch for course metadata
 */
async function fetchCourseMetadata(
  course_uuid: string,
  access_token?: string,
  withUnpublishedActivities = false,
): Promise<NormalizedFullCourse> {
  'use cache';
  const normalizedCourseUuid = course_uuid.startsWith('course_') ? course_uuid : `course_${course_uuid}`;
  cacheTag(tags.courses);
  cacheTag(courseTag.detail(normalizedCourseUuid));
  cacheLife(CacheProfiles.courses);

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (access_token) {
    headers.Authorization = `Bearer ${access_token}`;
  }

  const result = await fetch(
    `${getAPIUrl()}courses/${normalizedCourseUuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
    {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10_000),
    },
  );
  return normalizeFullCourse((await errorHandling(result)) as FullCourseRead);
}

export async function getCourseMetadata(
  course_uuid: string,
  _next?: any,
  access_token?: string | null,
  withUnpublishedActivities = false,
) {
  return fetchCourseMetadata(course_uuid, access_token || undefined, withUnpublishedActivities);
}

interface CourseWriteOptions {
  lastKnownUpdateDate?: string | null;
  includeEditableList?: boolean;
  includePublicList?: boolean;
}

const toCourseMetadataPayload = (data: any, options?: CourseWriteOptions) => ({
  name: data.name,
  description: data.description ?? '',
  about: data.about ?? '',
  learnings: Array.isArray(data.learnings) ? JSON.stringify(data.learnings) : data.learnings,
  tags: Array.isArray(data.tags) ? JSON.stringify(data.tags) : data.tags,
  thumbnail_type: data.thumbnail_type,
  last_known_update_date: options?.lastKnownUpdateDate ?? data.update_date ?? undefined,
});

export async function updateCourseMetadata(
  course_uuid: string,
  data: any,
  access_token: string,
  options?: CourseWriteOptions,
) {
  const result = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/metadata`,
    RequestBodyWithAuthHeader('PUT', toCourseMetadataPayload(data, options), null, access_token),
  );
  return getTypedResponseMetadata<NormalizedCourse>(result);
}

export async function updateCourseAccess(
  course_uuid: string,
  data: any,
  access_token: string,
  options?: CourseWriteOptions,
) {
  const result = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/access`,
    RequestBodyWithAuthHeader(
      'PUT',
      {
        ...data,
        last_known_update_date: options?.lastKnownUpdateDate ?? data.update_date ?? undefined,
      },
      null,
      access_token,
    ),
  );
  return getTypedResponseMetadata<NormalizedCourse>(result);
}

/**
 * Cached fetch for full course data
 */
async function fetchCourse(course_uuid: string, access_token: string): Promise<NormalizedCourse> {
  'use cache';
  cacheTag(tags.courses);
  cacheTag(courseTag.detail(course_uuid));
  cacheLife(CacheProfiles.courses);

  const result = await fetch(`${getAPIUrl()}courses/${course_uuid}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`,
    },
    signal: AbortSignal.timeout(10_000),
  });
  return normalizeCourse((await errorHandling(result)) as CourseRead);
}

export async function getCourse(course_uuid: string, _next?: any, access_token?: string) {
  if (!access_token) {
    throw new Error('Access token required');
  }
  return fetchCourse(course_uuid, access_token);
}

export async function updateCourseThumbnail(
  course_uuid: string,
  formData: FormData,
  access_token: string,
  options?: CourseWriteOptions,
) {
  if (options?.lastKnownUpdateDate) {
    formData.set('last_known_update_date', options.lastKnownUpdateDate);
  }

  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/thumbnail`,
    RequestBodyFormWithAuthHeader('PUT', formData, null, access_token),
  );
  return getTypedResponseMetadata<NormalizedCourse>(result);
}

export async function createNewCourse(
  course_body: any,
  thumbnail: any,
  access_token: string,
  options?: Pick<CourseWriteOptions, 'includeEditableList' | 'includePublicList'>,
) {
  // Send file thumbnail as form data
  const formData = new FormData();
  formData.append('name', course_body.name);
  formData.append('description', course_body.description || '');
  formData.append('public', course_body.visibility);
  formData.append('learnings', course_body.learnings || '');
  formData.append('tags', course_body.tags || '');
  formData.append('about', course_body.description || '');

  // Pass template so the backend can seed starter chapters atomically
  if (course_body.template && course_body.template !== 'outline') {
    formData.append('template', course_body.template);
  }

  if (thumbnail) {
    formData.append('thumbnail', thumbnail);
  }

  const result = await fetch(
    `${getAPIUrl()}courses`,
    RequestBodyFormWithAuthHeader('POST', formData, null, access_token),
  );
  return getTypedResponseMetadata<NormalizedCourse>(result);
}

/**
 * Search editable courses for the outline template combobox.
 * Not cached — used for interactive search.
 */
export async function searchEditableCourses(query: string, access_token: string, limit = 20) {
  const url = `${getAPIUrl()}courses/editable/page/1/limit/${limit}?query=${encodeURIComponent(query)}&sort_by=updated`;
  const result = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`,
    },
  });
  if (!result.ok) return [];
  const courses = ((await result.json()) as CourseReadWithPermissions[]).map((course) =>
    normalizeCourseWithPermissions(course),
  );
  return Array.isArray(courses) ? courses : [];
}

export async function deleteCourseFromBackend(
  course_uuid: string,
  access_token: string,
  options?: Pick<CourseWriteOptions, 'includeEditableList' | 'includePublicList'>,
) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token),
  );
  return (await errorHandling(result)) as CourseDetailResponse;
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
  options?: Pick<CourseWriteOptions, 'includeEditableList' | 'includePublicList'>,
) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/contributors/${contributor_id}?authorship=${authorship}&authorship_status=${authorship_status}`,
    RequestBodyWithAuthHeader('PUT', null, null, access_token || undefined),
  );
  return getResponseMetadata(result);
}

export async function applyForContributor(course_uuid: string, data: any, access_token: string | null | undefined) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/apply-contributor`,
    RequestBodyWithAuthHeader('POST', data, null, access_token || undefined),
  );
  return getResponseMetadata(result);
}

export async function bulkAddContributors(
  course_uuid: string,
  data: any,
  access_token: string | null | undefined,
  options?: Pick<CourseWriteOptions, 'includeEditableList' | 'includePublicList'>,
) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/bulk-add-contributors`,
    RequestBodyWithAuthHeader('POST', data, null, access_token || undefined),
  );
  return getResponseMetadata(result);
}

export async function bulkRemoveContributors(
  course_uuid: string,
  data: any,
  access_token: string | null | undefined,
  options?: Pick<CourseWriteOptions, 'includeEditableList' | 'includePublicList'>,
) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/bulk-remove-contributors`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token || undefined),
  );
  return getResponseMetadata(result);
}

export async function getCourseRights(course_uuid: string, access_token: string | null | undefined) {
  const result: any = await fetch(
    `${getAPIUrl()}courses/${course_uuid}/rights`,
    RequestBodyWithAuthHeader('GET', null, null, access_token || undefined),
  );
  return (await errorHandling(result)) as CourseUserRightsResponse;
}
