'use server';

import {
  RequestBody,
  RequestBodyFormWithAuthHeader,
  RequestBodyWithAuthHeader,
  errorHandling,
  getResponseMetadata,
} from '@services/utils/ts/requests';
import { resolveServerAccessToken } from '@/lib/auth/server-access-token';
import { getAPIUrl } from '@services/config/config';
import { tags } from '@/lib/cacheTags';

async function resolveToken(access_token?: string): Promise<string | undefined> {
  return resolveServerAccessToken(access_token);
}

export async function getUser(user_id: number, access_token?: string) {
  const token = await resolveToken(access_token);
  const result = await fetch(
    `${getAPIUrl()}users/id/${user_id}`,
    token ? RequestBodyWithAuthHeader('GET', null, null, token) : RequestBody('GET', null, null),
  );
  return await errorHandling(result);
}

export async function getUserByUsername(username: string, access_token?: string) {
  const token = await resolveToken(access_token);
  const result = await fetch(
    `${getAPIUrl()}users/username/${username}`,
    token ? RequestBodyWithAuthHeader('GET', null, null, token) : RequestBody('GET', null, null),
  );
  return await errorHandling(result);
}

export async function getCoursesByUser(user_id: number, access_token?: string) {
  const token = await resolveToken(access_token);
  const result = await fetch(
    `${getAPIUrl()}users/${user_id}/courses`,
    token ? RequestBodyWithAuthHeader('GET', null, null, token) : RequestBody('GET', null, null),
  );
  return await getResponseMetadata(result);
}
export async function updateUserAvatar(user_id: number, avatar_file: any, access_token: string) {
  const token = await resolveToken(access_token);
  if (!token) {
    throw new Error('Authentication required');
  }

  const formData = new FormData();
  formData.append('avatar_file', avatar_file);
  const result: any = await fetch(
    `${getAPIUrl()}users/update_avatar/${user_id}`,
    RequestBodyFormWithAuthHeader('PUT', formData, null, token),
  );
  const metadata = await getResponseMetadata(result);

  // Revalidate users cache after updating avatar
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.users, 'max');
  }

  return metadata;
}

export async function updateUserTheme(user_id: number, theme: string, access_token: string) {
  const token = await resolveToken(access_token);
  if (!token) {
    throw new Error('Authentication required');
  }

  const result = await fetch(
    `${getAPIUrl()}users/preferences/theme/${user_id}?theme=${encodeURIComponent(theme)}`,
    RequestBodyWithAuthHeader('PUT', null, null, token),
  );
  const data = await errorHandling(result);

  // Revalidate users cache after updating theme
  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.users, 'max');
  }

  return data;
}

export async function updateUserLocale(user_id: number, locale: string, access_token: string) {
  const token = await resolveToken(access_token);
  if (!token) {
    throw new Error('Authentication required');
  }

  const result = await fetch(
    `${getAPIUrl()}users/preferences/locale/${user_id}?locale=${encodeURIComponent(locale)}`,
    RequestBodyWithAuthHeader('PUT', null, null, token),
  );
  const data = await errorHandling(result);

  // Revalidate users cache after updating locale
  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.users, 'max');
  }

  return data;
}
