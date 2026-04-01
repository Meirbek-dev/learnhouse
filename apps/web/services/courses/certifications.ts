'use server';

import { RequestBodyWithAuthHeader, errorHandling, getResponseMetadata } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';

/*
 This file includes certification-related API calls
 GET requests are called from the frontend using SWR (https://swr.vercel.app/)
*/

export async function getCourseCertifications(course_uuid: string, next: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}certifications/course/${course_uuid}`,
    RequestBodyWithAuthHeader('GET', null, next, access_token),
  );
  return await getResponseMetadata(result);
}

interface CertificationInvalidationOptions {
  courseUuid?: string;
  includeEditableList?: boolean;
  lastKnownUpdateDate?: string | null;
}

export interface CreateCertificationParams {
  course_id: number;
  config: any;
  access_token: string;
  options?: CertificationInvalidationOptions;
}

export async function createCertification({ course_id, config, access_token, options }: CreateCertificationParams) {
  const result = await fetch(
    `${getAPIUrl()}certifications/`,
    RequestBodyWithAuthHeader(
      'POST',
      {
        course_id,
        config,
        last_known_update_date: options?.lastKnownUpdateDate ?? undefined,
      },
      null,
      access_token,
    ),
  );
  return errorHandling(result);
}

export interface UpdateCertificationParams {
  certification_uuid: string;
  config: any;
  access_token: string;
  options?: CertificationInvalidationOptions;
}

export async function updateCertification({
  certification_uuid,
  config,
  access_token,
  options,
}: UpdateCertificationParams) {
  const result = await fetch(
    `${getAPIUrl()}certifications/${certification_uuid}`,
    RequestBodyWithAuthHeader(
      'PUT',
      { config, last_known_update_date: options?.lastKnownUpdateDate ?? undefined },
      null,
      access_token,
    ),
  );
  return errorHandling(result);
}

export async function deleteCertification(
  certification_uuid: string,
  access_token: string,
  options?: CertificationInvalidationOptions,
) {
  const query = new URLSearchParams();
  if (options?.lastKnownUpdateDate) {
    query.set('last_known_update_date', options.lastKnownUpdateDate);
  }

  const result = await fetch(
    `${getAPIUrl()}certifications/${certification_uuid}${query.size > 0 ? `?${query.toString()}` : ''}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token),
  );
  return errorHandling(result);
}

export async function getUserCertificates(course_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}certifications/user/course/${course_uuid}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token),
  );
  return getResponseMetadata(result);
}

export async function getCertificateByUuid(user_certification_uuid: string) {
  const result = await fetch(`${getAPIUrl()}certifications/certificate/${user_certification_uuid}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return getResponseMetadata(result);
}

export async function getAllUserCertificates(access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}certifications/user/all`,
    RequestBodyWithAuthHeader('GET', null, null, access_token),
  );
  return getResponseMetadata(result);
}
