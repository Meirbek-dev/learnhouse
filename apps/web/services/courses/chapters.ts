'use server';

import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests';
import type { CourseOrderPayload } from '@/schemas/chapterSchemas';
import { getAPIUrl } from '@services/config/config';

/*
 This file includes only POST, PATCH, DELETE requests
 GET requests are called from the frontend using SWR (https://swr.vercel.app/)
*/

export async function updateChapter(chapterUuid: string, data: any, access_token: string) {
  const result: any = await fetch(
    `${getAPIUrl()}chapters/${chapterUuid}`,
    RequestBodyWithAuthHeader('PATCH', data, null, access_token),
  );
  return errorHandling(result);
}

export async function updateCourseOrderStructure(
  course_uuid: string,
  data: CourseOrderPayload,
  access_token: string,
) {
  const result: any = await fetch(
    `${getAPIUrl()}chapters/course/${course_uuid}/order`,
    RequestBodyWithAuthHeader('PATCH', data, null, access_token),
  );
  return errorHandling(result);
}

export async function createChapter(data: any, access_token: string) {
  const result: any = await fetch(
    `${getAPIUrl()}chapters/`,
    RequestBodyWithAuthHeader('POST', data, null, access_token),
  );
  return errorHandling(result);
}

export async function deleteChapter(chapterUuid: string, access_token: string) {
  const result: any = await fetch(
    `${getAPIUrl()}chapters/${chapterUuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token),
  );
  return errorHandling(result);
}
