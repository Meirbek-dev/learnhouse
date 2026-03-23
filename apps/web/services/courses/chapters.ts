'use server';

import type { OrderPayload } from '@components/Dashboard/Pages/Course/EditCourseStructure/EditCourseStructure';
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';

/*
 This file includes only POST, PUT, DELETE requests
 GET requests are called from the frontend using SWR (https://swr.vercel.app/)
*/

export async function updateChaptersMetadata(course_uuid: string, data: any, access_token: string) {
  const result: any = await fetch(
    `${getAPIUrl()}chapters/course/course_${course_uuid}/order`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token),
  );
  return errorHandling(result);
}

interface ChapterInvalidationOptions {
  courseUuid?: string;
  lastKnownUpdateDate?: string | null;
}

export async function updateChapter(
  coursechapter_id: number,
  data: any,
  access_token: string,
  options?: ChapterInvalidationOptions,
) {
  const result: any = await fetch(
    `${getAPIUrl()}chapters/${coursechapter_id}`,
    RequestBodyWithAuthHeader(
      'PUT',
      {
        ...data,
        last_known_update_date: options?.lastKnownUpdateDate ?? data.last_known_update_date ?? undefined,
      },
      null,
      access_token,
    ),
  );
  return errorHandling(result);
}

export async function updateCourseOrderStructure(
  course_uuid: string,
  data: OrderPayload,
  access_token: string,
  options?: ChapterInvalidationOptions,
) {
  const result: any = await fetch(
    `${getAPIUrl()}chapters/course/${course_uuid}/order`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token),
  );
  return errorHandling(result);
}

export async function createChapter(data: any, access_token: string, options?: ChapterInvalidationOptions) {
  const result: any = await fetch(
    `${getAPIUrl()}chapters/`,
    RequestBodyWithAuthHeader(
      'POST',
      {
        ...data,
        last_known_update_date: options?.lastKnownUpdateDate ?? data.last_known_update_date ?? undefined,
      },
      null,
      access_token,
    ),
  );
  return errorHandling(result);
}

export async function deleteChapter(
  coursechapter_id: number,
  access_token: string,
  options?: ChapterInvalidationOptions,
) {
  const query = new URLSearchParams();
  if (options?.lastKnownUpdateDate) {
    query.set('last_known_update_date', options.lastKnownUpdateDate);
  }

  const result: any = await fetch(
    `${getAPIUrl()}chapters/${coursechapter_id}${query.size > 0 ? `?${query.toString()}` : ''}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token),
  );
  return errorHandling(result);
}
