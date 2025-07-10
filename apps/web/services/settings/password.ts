import { getAPIUrl } from '@services/config/config';
import { getResponseMetadata, RequestBodyWithAuthHeader } from '@services/utils/ts/requests';

/*
 This file includes only POST, PUT, DELETE requests
 GET requests are called from the frontend using SWR (https://swr.vercel.app/)
*/

export async function updatePassword(user_id: number, data: any, access_token: string) {
  const result: any = await fetch(
    `${getAPIUrl()}users/change_password/${user_id}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token),
  );
  const res = await getResponseMetadata(result);
  return res;
}
