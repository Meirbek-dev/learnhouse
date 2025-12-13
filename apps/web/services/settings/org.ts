'use server';

import { RequestBodyFormWithAuthHeader, RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { tags } from '@/lib/cacheTags';

/*
 This file includes only POST, PUT, DELETE requests
 GET requests are called from the frontend using SWR (https://swr.vercel.app/)
*/

export async function updateOrganization(org_id: number, data: any, access_token: string) {
  const result: any = await fetch(
    `${getAPIUrl()}orgs/${org_id}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token),
  );
  const response = await errorHandling(result);
  const { revalidateTag } = await import('next/cache');
  revalidateTag(tags.organizations, 'max');
  return response;
}

export async function uploadOrganizationLogo(org_id: number, logo_file: any, access_token: string) {
  // Send file thumbnail as form data
  const formData = new FormData();
  formData.append('logo_file', logo_file);
  const result: any = await fetch(
    `${getAPIUrl()}orgs/${org_id}/logo`,
    RequestBodyFormWithAuthHeader('PUT', formData, null, access_token),
  );
  const response = await errorHandling(result);
  const { revalidateTag } = await import('next/cache');
  revalidateTag(tags.organizations, 'max');
  return response;
}

export async function uploadOrganizationThumbnail(org_id: number, thumbnail_file: any, access_token: string) {
  // Send file thumbnail as form data
  const formData = new FormData();
  formData.append('thumbnail_file', thumbnail_file);
  const result: any = await fetch(
    `${getAPIUrl()}orgs/${org_id}/thumbnail`,
    RequestBodyFormWithAuthHeader('PUT', formData, null, access_token),
  );
  const response = await errorHandling(result);
  const { revalidateTag } = await import('next/cache');
  revalidateTag(tags.organizations, 'max');
  return response;
}

export const uploadOrganizationPreview = async (orgId: number, file: File, access_token: string) => {
  const formData = new FormData();
  formData.append('preview_file', file);

  const result: any = await fetch(
    `${getAPIUrl()}orgs/${orgId}/preview`,
    RequestBodyFormWithAuthHeader('PUT', formData, null, access_token),
  );
  const response = await errorHandling(result);
  const { revalidateTag } = await import('next/cache');
  revalidateTag(tags.organizations, 'max');
  return response;
};
