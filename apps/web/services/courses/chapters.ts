import type { OrderPayload } from '@components/Dashboard/Pages/Course/EditCourseStructure/EditCourseStructure';
import { getAPIUrl } from '@services/config/config';
import { errorHandling, RequestBodyWithAuthHeader } from '@services/utils/ts/requests';

/*
 This file includes only POST, PUT, DELETE requests
 GET requests are called from the frontend using SWR (https://swr.vercel.app/)
*/

// TODO : deprecate this function
export async function getCourseChaptersMetadata(course_uuid: string, next: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}chapters/meta/course_${course_uuid}`,
    RequestBodyWithAuthHeader('GET', null, next, access_token),
  );
  const res = await errorHandling(result);
  return res;
}

export async function updateChaptersMetadata(course_uuid: string, data: any, access_token: string) {
  const result: any = await fetch(
    `${getAPIUrl()}chapters/course/course_${course_uuid}/order`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token),
  );
  const res = await errorHandling(result);
  return res;
}

export async function updateChapter(coursechapter_id: number, data: any, access_token: string) {
  const result: any = await fetch(
    `${getAPIUrl()}chapters/${coursechapter_id}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token),
  );
  const res = await errorHandling(result);
  return res;
}

export async function updateCourseOrderStructure(course_uuid: string, data: OrderPayload, access_token: string) {
  const result: any = await fetch(
    `${getAPIUrl()}chapters/course/${course_uuid}/order`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token),
  );
  const res = await errorHandling(result);
  return res;
}

export async function createChapter(data: any, access_token: string) {
  const result: any = await fetch(
    `${getAPIUrl()}chapters/`,
    RequestBodyWithAuthHeader('POST', data, null, access_token),
  );
  const res = await errorHandling(result);

  return res;
}

export async function deleteChapter(coursechapter_id: number, access_token: string) {
  const result: any = await fetch(
    `${getAPIUrl()}chapters/${coursechapter_id}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token),
  );
  const res = await errorHandling(result);
  return res;
}
