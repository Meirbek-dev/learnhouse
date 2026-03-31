import { RequestBodyWithAuthHeader, getResponseMetadata } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';

export interface SearchContentParams {
  query: string;
  page?: number;
  limit?: number;
  next?: any;
  access_token?: any;
}

export async function searchContent({
  query,
  page = 1,
  limit = 20,
  next,
  access_token,
}: SearchContentParams) {
  const result: any = await fetch(
    `${getAPIUrl()}search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
    RequestBodyWithAuthHeader('GET', null, next, access_token),
  );
  return await getResponseMetadata(result);
}
