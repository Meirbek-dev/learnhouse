'use server';

import {
  RequestBodyFormWithAuthHeader,
  RequestBodyWithAuthHeader,
  errorHandling,
  getResponseMetadata,
} from '@services/utils/ts/requests';
import { cacheLife, cacheTag, CacheProfiles } from '@/lib/cache';
import { tags } from '@/lib/cacheTags';
import { getAPIUrl } from '@services/config/config';

/*
 This file includes POST, PUT, DELETE requests and cached GET requests
 Client-side GET requests are called from the frontend using SWR
*/

export async function createNewOrganization(body: any, access_token: string) {
  const result = await fetch(`${getAPIUrl()}orgs/`, RequestBodyWithAuthHeader('POST', body, null, access_token));
  return await errorHandling(result);
}

export async function deleteOrganizationFromBackend(org_id: number, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token),
  );
  return await errorHandling(result);
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
    headers['Authorization'] = `Bearer ${access_token}`;
  }

  const result = await fetch(`${getAPIUrl()}orgs/slug/${org_slug}`, {
    method: 'GET',
    headers,
  });
  return await errorHandling(result);
}

export async function getOrganizationContextInfo(org_slug: any, _next?: any, access_token?: string) {
  return fetchOrganizationBySlug(org_slug, access_token);
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

export async function getOrganizationContextInfoWithId(org_id: number, _next?: any, access_token?: string) {
  if (!access_token) {
    throw new Error('Access token required');
  }
  return await fetchOrganizationById(org_id, access_token);
}

export async function getOrganizationContextInfoWithoutCredentials(org_slug: any, _next?: any) {
  return await fetchOrganizationBySlug(org_slug);
}

export async function getOrganizationContextInfoNoAsync(org_slug: any, next: any, access_token: string) {
  return await fetch(`${getAPIUrl()}orgs/slug/${org_slug}`, RequestBodyWithAuthHeader('GET', null, next, access_token));
}

export async function updateUserRole(org_id: number, user_id: number, role_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/users/${user_id}/role/${role_uuid}`,
    RequestBodyWithAuthHeader('PUT', null, null, access_token),
  );
  return await getResponseMetadata(result);
}

export async function updateOrgLanding(org_id: number, landing_object: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/landing`,
    RequestBodyWithAuthHeader('PUT', landing_object, null, access_token),
  );
  return await getResponseMetadata(result);
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
  return await getResponseMetadata(result);
}

export async function joinOrg(
  args: {
    org_id: number;
    user_id: number;
    invite_code?: string | null;
  },
  next: any,
  access_token?: string,
) {
  // Clean up invite_code - send null instead of empty string
  const cleanArgs = {
    ...args,
    invite_code: args.invite_code?.trim() || null,
  };

  const result = await fetch(
    `${getAPIUrl()}orgs/join`,
    RequestBodyWithAuthHeader('POST', cleanArgs, next, access_token),
  );
  return await getResponseMetadata(result);
}
