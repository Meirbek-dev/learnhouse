'use server';

import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { tags } from '@/lib/cacheTags';

export async function submitQuizBlock(activity_id: number, data: any, access_token: string) {
  try {
    const result = await fetch(
      `${getAPIUrl()}blocks/quiz/${activity_id}`,
      RequestBodyWithAuthHeader('POST', data, null, access_token),
    );
    const response = await result.json();
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.activities, 'max');
    revalidateTag(tags.courses, 'max');
    return response;
  } catch (error) {
    console.log('error', error);
    throw error;
  }
}
