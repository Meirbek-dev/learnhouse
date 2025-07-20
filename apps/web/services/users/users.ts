import {
  RequestBody,
  RequestBodyFormWithAuthHeader,
  RequestBodyWithAuthHeader,
  errorHandling,
  getResponseMetadata,
} from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';

export async function getUser(user_id: number, access_token?: string) {
  const result = await fetch(
    `${getAPIUrl()}users/id/${user_id}`,
    access_token ? RequestBodyWithAuthHeader('GET', null, null, access_token) : RequestBody('GET', null, null),
  );
  const res = await errorHandling(result);
  return res;
}

export async function getUserByUsername(username: string, access_token?: string) {
  const result = await fetch(
    `${getAPIUrl()}users/username/${username}`,
    access_token ? RequestBodyWithAuthHeader('GET', null, null, access_token) : RequestBody('GET', null, null),
  );
  const res = await errorHandling(result);
  return res;
}

export async function getCoursesByUser(user_id: number, access_token?: string) {
  const result = await fetch(
    `${getAPIUrl()}users/${user_id}/courses`,
    access_token ? RequestBodyWithAuthHeader('GET', null, null, access_token) : RequestBody('GET', null, null),
  );
  const res = await getResponseMetadata(result);
  return res;
}
export async function updateUserAvatar(user_id: number, avatar_file: any, access_token: string) {
  const formData = new FormData();
  formData.append('avatar_file', avatar_file);
  const result: any = await fetch(
    `${getAPIUrl()}users/update_avatar/${user_id}`,
    RequestBodyFormWithAuthHeader('PUT', formData, null, access_token),
  );
  const res = await getResponseMetadata(result);
  return res;
}
