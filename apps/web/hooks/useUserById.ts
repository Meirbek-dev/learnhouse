'use client';
import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import useSWR from 'swr';

export function useUserById(userId: number | string | undefined) {
  return useSWR(userId !== null ? `${getAPIUrl()}users/id/${userId}` : null, (url: string) => swrFetcher(url));
}
