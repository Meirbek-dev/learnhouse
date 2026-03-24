'use server';

import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests';
import type { CourseOrderPayload } from '@/schemas/chapterSchemas';
import { getAPIUrl } from '@services/config/config';

/*
 This file includes only POST, PUT, DELETE requests
 GET requests are called from the frontend using SWR (https://swr.vercel.app/)
*/

interface ChapterInvalidationOptions {
  courseUuid?: string;
  lastKnownUpdateDate?: string | null;
}

export async function updateChapter(
  chapterUuid: string,
  data: any,
  access_token: string,
  options?: ChapterInvalidationOptions,
) {
  const result: any = await fetch(
    `${getAPIUrl()}chapters/${chapterUuid}`,
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
  data: CourseOrderPayload,
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

export async function deleteChapter(chapterUuid: string, access_token: string, options?: ChapterInvalidationOptions) {
  const result: any = await fetch(
    `${getAPIUrl()}chapters/${chapterUuid}`,
    RequestBodyWithAuthHeader(
      'DELETE',
      { last_known_update_date: options?.lastKnownUpdateDate ?? undefined },
      null,
      access_token,
    ),
  );
  return errorHandling(result);
}
