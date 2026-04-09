'use client';

import { useQuery } from '@tanstack/react-query';
import { userByIdQueryOptions } from '@/features/users/queries/users.query';

export function useUserById(userId: number | string | undefined) {
  const normalizedUserId = userId === undefined || userId === null ? null : Number(userId);

  return useQuery({
    ...userByIdQueryOptions(normalizedUserId ?? 0),
    enabled: normalizedUserId !== null,
  });
}
