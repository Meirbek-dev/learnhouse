import { RequestBodyWithAuthHeader, getResponseMetadata } from '@services/utils/ts/requests';
import { resolveServerAccessToken } from '@/lib/auth/server-access-token';
import { getAPIUrl } from '@services/config/config';

/*
 This file includes only POST, PUT, DELETE requests
 GET requests are called from the frontend using SWR (https://swr.vercel.app/)
*/

export async function updatePassword(user_id: number, data: any, access_token: string) {
  const token = await resolveServerAccessToken(access_token);
  if (!token) {
    throw new Error('Authentication required');
  }

  const result: any = await fetch(
    `${getAPIUrl()}users/change_password/${user_id}`,
    RequestBodyWithAuthHeader('PUT', data, null, token),
  );
  return await getResponseMetadata(result);
}
