'use client';

import { useQuery } from '@tanstack/react-query';
import { userCertificatesQueryOptions } from '@/features/courses/queries/course.query';

export function useUserCertificates() {
  return useQuery(userCertificatesQueryOptions());
}
