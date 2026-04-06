'use server';

import { errorHandling } from '@services/utils/ts/requests';
import { apiFetch } from '@/lib/api-client';
import { tags } from '@/lib/cacheTags';

/*
 This file includes only POST, PUT, DELETE requests
 GET requests are called from the frontend using SWR (https://swr.vercel.app/)
*/

export async function startCourse(course_uuid: string) {
  const result = await apiFetch(`trail/add_course/${course_uuid}`, { method: 'POST' });
  const data_result = await errorHandling(result);

  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
  }

  return data_result;
}

export async function removeCourse(course_uuid: string) {
  const result = await apiFetch(`trail/remove_course/${course_uuid}`, { method: 'DELETE' });
  const data_result = await errorHandling(result);

  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
  }

  return data_result;
}

export async function markActivityAsComplete(activity_uuid: string) {
  const result = await apiFetch(`trail/add_activity/${activity_uuid}`, { method: 'POST' });
  const data_result = await errorHandling(result);

  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
  }

  return data_result;
}

export async function unmarkActivityAsComplete(activity_uuid: string) {
  const result = await apiFetch(`trail/remove_activity/${activity_uuid}`, { method: 'DELETE' });
  const data_result = await errorHandling(result);

  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
  }

  return data_result;
}
