'use server';

import type { components } from '@/lib/api/generated';
import {
  type CustomResponseTyping,
  RequestBodyFormWithAuthHeader,
  RequestBodyWithAuthHeader,
  errorHandling,
  getResponseMetadata,
} from '@services/utils/ts/requests';
import { CacheProfiles, cacheLife, cacheTag } from '@/lib/cache';
import { getServerAPIUrl } from '@services/config/config';
import { tags } from '@/lib/cacheTags';

/*
 This file includes POST, PUT, DELETE requests and cached GET requests
 Client-side GET requests are called from the frontend using SWR
*/

type PlatformRead = components['schemas']['PlatformRead'];
type PlatformDetailResponse = components['schemas']['PlatformDetailResponse'];
type PlatformLandingUploadResponse = components['schemas']['PlatformLandingUploadResponse'];

type ResponseMetadata<T> = Omit<CustomResponseTyping, 'data'> & {
  data: T | null;
};

async function getTypedResponseMetadata<T>(response: Response): Promise<ResponseMetadata<T>> {
  return (await getResponseMetadata(response)) as ResponseMetadata<T>;
}

async function fetchPlatform(access_token?: string): Promise<PlatformRead | null> {
  'use cache';
  cacheTag(tags.platform);
  cacheLife(CacheProfiles.platform);

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (access_token) {
    headers.Authorization = `Bearer ${access_token}`;
  }

  try {
    const result = await fetch(`${getServerAPIUrl()}platform`, {
      method: 'GET',
      headers,
    });
    return await errorHandling(result);
  } catch {
    // Backend is unavailable (e.g. during build time) – return null so
    // the layout renders a shell that hydrates with real data at runtime.
    return null;
  }
}

export async function getPlatform(access_token?: string) {
  return fetchPlatform(access_token);
}

export async function updateLanding(
  landing_object: Record<string, unknown>,
  access_token: string,
): Promise<ResponseMetadata<PlatformDetailResponse>> {
  const result = await fetch(
    `${getServerAPIUrl()}landing`,
    RequestBodyWithAuthHeader('PUT', landing_object, null, access_token),
  );
  const metadata = await getTypedResponseMetadata<PlatformDetailResponse>(result);

  // Revalidate platform cache after landing update
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.platform, 'max');
  }

  return metadata;
}

export async function uploadLandingContent(content_file: File, access_token: string) {
  const formData = new FormData();
  formData.append('content_file', content_file);

  const result = await fetch(
    `${getServerAPIUrl()}landing/content`,
    RequestBodyFormWithAuthHeader('POST', formData, null, access_token),
  );
  return await getTypedResponseMetadata<PlatformLandingUploadResponse>(result);
}

export async function removeUser(
  user_id: number,
  access_token: string,
): Promise<ResponseMetadata<PlatformDetailResponse>> {
  const result = await fetch(
    `${getServerAPIUrl()}members/${user_id}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token),
  );
  const metadata = await getTypedResponseMetadata<PlatformDetailResponse>(result);

  // Revalidate cache after user removal
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.platform, 'max');
    revalidateTag(tags.users, 'max');
  }

  return metadata;
}
