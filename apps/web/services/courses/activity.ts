import { getAPIUrl } from '@services/config/config';
import { errorHandling, RequestBodyWithAuthHeader } from '@services/utils/ts/requests';

/*
 This file includes only POST, PUT, DELETE requests
 GET requests are called from the frontend using SWR (https://swr.vercel.app/)
*/

export async function startCourse(course_uuid: string, _org_slug: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}trail/add_course/${course_uuid}`,
    RequestBodyWithAuthHeader('POST', null, null, access_token),
  );
  return errorHandling(result);
}

export async function removeCourse(course_uuid: string, _org_slug: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}trail/remove_course/${course_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token),
  );
  return errorHandling(result);
}

export async function markActivityAsComplete(
  _org_slug: string,
  _course_uuid: string,
  activity_uuid: string,
  access_token: string,
) {
  const result = await fetch(
    `${getAPIUrl()}trail/add_activity/${activity_uuid}`,
    RequestBodyWithAuthHeader('POST', null, null, access_token),
  );
  return errorHandling(result);
}

export async function unmarkActivityAsComplete(
  _org_slug: string,
  _course_uuid: string,
  activity_uuid: string,
  access_token: string,
) {
  const result = await fetch(
    `${getAPIUrl()}trail/remove_activity/${activity_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token),
  );
  return errorHandling(result);
}
