'use client';

import { useCourseList as useCourseListSWR } from '@/hooks/courses/useCourseList';

export function useCourseList(page = 1, limit = 20) {
  return useCourseListSWR({ page, limit });
}
