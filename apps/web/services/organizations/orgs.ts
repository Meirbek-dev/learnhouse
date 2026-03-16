'use server';

import {
  RequestBodyFormWithAuthHeader,
  RequestBodyWithAuthHeader,
  errorHandling,
  getResponseMetadata,
} from '@services/utils/ts/requests';
import { getAPIUrl, PLATFORM_ORG_SLUG } from '@services/config/config';
import { CacheProfiles, cacheLife, cacheTag } from '@/lib/cache';
import { tags } from '@/lib/cacheTags';

/*
 This file includes POST, PUT, DELETE requests and cached GET requests
 Client-side GET requests are called from the frontend using SWR
*/

export async function createNewOrganization(body: any, access_token: string) {
  const result = await fetch(`${getAPIUrl()}orgs/`, RequestBodyWithAuthHeader('POST', body, null, access_token));
  const data = await errorHandling(result);

  // Revalidate organizations cache after creating organization
  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.organizations, 'max');
  }

  return data;
}

export async function deleteOrganizationFromBackend(org_id: number, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token),
  );
  const data = await errorHandling(result);

  // Revalidate organizations cache after deleting organization
  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.organizations, 'max');
  }

  return data;
}

/**
 * Cached fetch for organization context info by slug
 * Uses `use cache` directive for cacheComponents
 */
async function fetchOrganizationBySlug(org_slug: string, access_token?: string) {
  'use cache';
  cacheTag(tags.organizations);
  cacheLife(CacheProfiles.organization);

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (access_token) {
    headers.Authorization = `Bearer ${access_token}`;
  }

  const result = await fetch(`${getAPIUrl()}orgs/slug/${org_slug}`, {
    method: 'GET',
    headers,
  });
  return await errorHandling(result);
}

async function fetchPlatformOrganization(access_token?: string) {
  'use cache';
  cacheTag(tags.organizations);
  cacheLife(CacheProfiles.organization);

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (access_token) {
    headers.Authorization = `Bearer ${access_token}`;
  }

  const result = await fetch(`${getAPIUrl()}orgs/platform`, {
    method: 'GET',
    headers,
  });
  return await errorHandling(result);
}

export async function getOrganizationContextInfo(org_slug: string, _next?: unknown, access_token?: string) {
  if (org_slug === PLATFORM_ORG_SLUG) {
    return fetchPlatformOrganization(access_token);
  }
  return fetchOrganizationBySlug(org_slug, access_token);
}

export async function getPlatformOrganizationContextInfo(access_token?: string) {
  return fetchPlatformOrganization(access_token);
}

/**
 * Cached fetch for organization context info by ID
 */
async function fetchOrganizationById(org_id: number, access_token: string) {
  'use cache';
  cacheTag(tags.organizations);
  cacheLife(CacheProfiles.organization);

  const result = await fetch(`${getAPIUrl()}orgs/${org_id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`,
    },
  });
  return await errorHandling(result);
}

export async function getOrganizationContextInfoWithId(org_id: number, _next?: unknown, access_token?: string) {
  if (!access_token) {
    throw new Error('Access token required');
  }
  return await fetchOrganizationById(org_id, access_token);
}

export async function getOrganizationContextInfoWithoutCredentials(org_slug: string, _next?: unknown) {
  if (org_slug === PLATFORM_ORG_SLUG) {
    return await fetchPlatformOrganization();
  }
  return await fetchOrganizationBySlug(org_slug);
}

export async function getOrganizationContextInfoNoAsync(org_slug: string, next: unknown, access_token: string) {
  if (org_slug === PLATFORM_ORG_SLUG) {
    return await fetch(`${getAPIUrl()}orgs/platform`, RequestBodyWithAuthHeader('GET', null, next, access_token));
  }
  return await fetch(`${getAPIUrl()}orgs/slug/${org_slug}`, RequestBodyWithAuthHeader('GET', null, next, access_token));
}

export async function updateOrgLanding(org_id: number, landing_object: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/landing`,
    RequestBodyWithAuthHeader('PUT', landing_object, null, access_token),
  );
  const metadata = await getResponseMetadata(result);

  // Revalidate organizations cache after landing update
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.organizations, 'max');
  }

  return metadata;
}

export async function uploadLandingContent(org_uuid: string, content_file: File, access_token: string) {
  const formData = new FormData();
  formData.append('content_file', content_file);

  const result = await fetch(
    `${getAPIUrl()}orgs/${org_uuid}/landing/content`,
    RequestBodyFormWithAuthHeader('POST', formData, null, access_token),
  );
  return await getResponseMetadata(result);
}

export async function removeUserFromOrg(org_id: number, user_id: number, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/users/${user_id}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token),
  );
  const metadata = await getResponseMetadata(result);

  // Revalidate organizations cache after user removal
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.organizations, 'max');
    revalidateTag(tags.users, 'max');
  }

  return metadata;
}
