'use server';
import { RequestBodyWithAuthHeader, getResponseMetadata } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { tags } from '@/lib/cacheTags';

export async function getProducts(orgId: number, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}payments/${orgId}/products`,
    RequestBodyWithAuthHeader('GET', null, null, access_token),
  );
  return await getResponseMetadata(result);
}

export async function createProduct(orgId: number, data: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}payments/${orgId}/products`,
    RequestBodyWithAuthHeader('POST', data, null, access_token),
  );
  const metadata = await getResponseMetadata(result);

  // Revalidate courses cache after creating product
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
  }

  return metadata;
}

export async function updateProduct(orgId: number, productId: string, data: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}payments/${orgId}/products/${productId}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token),
  );
  const metadata = await getResponseMetadata(result);

  // Revalidate courses cache after updating product
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
  }

  return metadata;
}

export async function archiveProduct(orgId: number, productId: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}payments/${orgId}/products/${productId}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token),
  );
  const metadata = await getResponseMetadata(result);

  // Revalidate courses cache after archiving product
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
  }

  return metadata;
}

export async function getProductDetails(orgId: number, productId: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}payments/${orgId}/products/${productId}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token),
  );
  return await getResponseMetadata(result);
}

export async function linkCourseToProduct(orgId: number, productId: string, courseId: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}payments/${orgId}/products/${productId}/courses/${courseId}`,
    RequestBodyWithAuthHeader('POST', null, null, access_token),
  );
  const metadata = await getResponseMetadata(result);

  // Revalidate courses cache after linking course to product
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
  }

  return metadata;
}

export async function unlinkCourseFromProduct(
  orgId: number,
  productId: string,
  courseId: string,
  access_token: string,
) {
  const result = await fetch(
    `${getAPIUrl()}payments/${orgId}/products/${productId}/courses/${courseId}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token),
  );
  const metadata = await getResponseMetadata(result);

  // Revalidate courses cache after unlinking course from product
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
  }

  return metadata;
}

export async function getCoursesLinkedToProduct(orgId: number, productId: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}payments/${orgId}/products/${productId}/courses`,
    RequestBodyWithAuthHeader('GET', null, null, access_token),
  );
  return await getResponseMetadata(result);
}

export async function getProductsByCourse(orgId: number, courseId: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}payments/${orgId}/courses/${courseId}/products`,
    RequestBodyWithAuthHeader('GET', null, null, access_token),
  );
  return await getResponseMetadata(result);
}

export async function getStripeProductCheckoutSession(
  orgId: number,
  productId: number,
  redirect_uri: string,
  access_token: string,
) {
  const result = await fetch(
    `${getAPIUrl()}payments/${orgId}/stripe/checkout/product/${productId}?redirect_uri=${redirect_uri}`,
    RequestBodyWithAuthHeader('POST', null, null, access_token),
  );
  return await getResponseMetadata(result);
}
