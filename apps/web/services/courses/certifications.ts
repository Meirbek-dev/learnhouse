'use server';

import { RequestBodyWithAuthHeader, errorHandling, getResponseMetadata } from '@services/utils/ts/requests';
import { courseTag, getCourseListTags, tags } from '@/lib/cacheTags';
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
  orgSlug?: string;
  includeEditableList?: boolean;
}

async function revalidateCertificationTags(options?: CertificationInvalidationOptions) {
  const { revalidateTag } = await import('next/cache');
  const tagsToRevalidate = new Set<string>();

  if (options?.courseUuid) {
    tagsToRevalidate.add(courseTag.detail(options.courseUuid));
    tagsToRevalidate.add(courseTag.certifications(options.courseUuid));
  }

  if (options?.orgSlug) {
    getCourseListTags(options.orgSlug, {
      includeEditable: options.includeEditableList ?? true,
      includePublic: false,
    }).forEach((tag) => tagsToRevalidate.add(tag));
  } else if (options?.includeEditableList ?? true) {
    tagsToRevalidate.add(tags.editableCourses);
  }

  if (tagsToRevalidate.size === 0) {
    tagsToRevalidate.add(tags.courses);
  }

  for (const tag of tagsToRevalidate) {
    revalidateTag(tag, 'max');
  }
}

export async function createCertification(
  course_id: number,
  config: any,
  access_token: string,
  options?: CertificationInvalidationOptions,
) {
  const result = await fetch(
    `${getAPIUrl()}certifications/`,
    RequestBodyWithAuthHeader('POST', { course_id, config }, null, access_token),
  );
  const data = await errorHandling(result);

  // Revalidate courses cache after creating certification
  if (result.ok) {
    await revalidateCertificationTags(options);
  }

  return data;
}

export async function updateCertification(
  certification_uuid: string,
  config: any,
  access_token: string,
  options?: CertificationInvalidationOptions,
) {
  const result = await fetch(
    `${getAPIUrl()}certifications/${certification_uuid}`,
    RequestBodyWithAuthHeader('PUT', { config }, null, access_token),
  );
  const data = await errorHandling(result);

  // Revalidate courses cache after updating certification
  if (result.ok) {
    await revalidateCertificationTags(options);
  }

  return data;
}

export async function deleteCertification(
  certification_uuid: string,
  access_token: string,
  options?: CertificationInvalidationOptions,
) {
  const result = await fetch(
    `${getAPIUrl()}certifications/${certification_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token),
  );
  const data = await errorHandling(result);

  // Revalidate courses cache after deleting certification
  if (result.ok) {
    await revalidateCertificationTags(options);
  }

  return data;
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
