'use server';

import { RequestBodyWithAuthHeader, getResponseMetadata } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { tags } from '@/lib/cacheTags';

/*
  Roles service matching available endpoints:
  - GET    roles/org/{org_id}
  - POST   roles/org/{org_id}
  - GET    roles/{role_id}
  - PUT    roles/{role_id}
  - DELETE roles/{role_id}

  Note: GET requests are usually fetched with SWR directly from components.
*/

export interface CreateOrUpdateRoleBody {
  name: string;
  description?: string;
  org_id?: number;
}

export async function createRole(body: CreateOrUpdateRoleBody, access_token: string) {
  const { org_id, ...payload } = body;
  if (!org_id) throw new Error('createRole requires org_id in body');
  const result = await fetch(
    `${getAPIUrl()}roles/org/${org_id}`,
    RequestBodyWithAuthHeader('POST', payload, null, access_token),
  );
  const metadata = await getResponseMetadata(result);

  // Revalidate organizations cache after creating role
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.organizations, 'max');
  }

  return metadata;
}

export async function getRole(role_id: number | string, access_token?: string) {
  const result = await fetch(
    `${getAPIUrl()}roles/${role_id}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token),
  );
  return await getResponseMetadata(result);
}

export async function updateRole(role_id: number | string, body: CreateOrUpdateRoleBody, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}roles/${role_id}`,
    RequestBodyWithAuthHeader('PUT', body, null, access_token),
  );
  const metadata = await getResponseMetadata(result);

  // Revalidate organizations cache after updating role
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.organizations, 'max');
  }

  return metadata;
}

export async function deleteRole(role_id: number | string, _org_id: number | string | undefined, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}roles/${role_id}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token),
  );
  const metadata = await getResponseMetadata(result);

  // Revalidate organizations cache after deleting role
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.organizations, 'max');
  }

  return metadata;
}
