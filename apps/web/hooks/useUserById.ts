'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { queryKeys } from '@/lib/react-query/queryKeys';

export function useUserById(userId: number | string | undefined) {
  const normalizedUserId = userId === undefined || userId === null ? null : Number(userId);

  return useQuery({
    queryKey: normalizedUserId === null ? ['users', 'detail', 'missing'] : queryKeys.users.byId(normalizedUserId),
    queryFn: () => apiFetcher(`${getAPIUrl()}users/id/${normalizedUserId}`),
    enabled: normalizedUserId !== null,
  });
}
