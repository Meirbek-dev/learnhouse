'use server';
import { RequestBodyWithAuthHeader, getResponseMetadata } from '@services/utils/ts/requests';
import { resolveServerAccessToken } from '@/lib/auth/server-access-token';
import type { CustomResponseTyping } from '@services/utils/ts/requests';
import type { components } from '@/lib/api/generated';
import { getAPIUrl } from '@services/config/config';
import { tags } from '@/lib/cacheTags';

type CourseRead = components['schemas']['CourseRead'];
type PaymentsCheckoutSessionResponse = components['schemas']['PaymentsCheckoutSessionResponse'];
type PaymentsMessageResponse = components['schemas']['PaymentsMessageResponse'];
type PaymentsProductCreate = components['schemas']['PaymentsProductCreate'];
type PaymentsProductRead = components['schemas']['PaymentsProductRead'];
type PaymentsProductUpdate = components['schemas']['PaymentsProductUpdate'];

type ResponseMetadata<T> = Omit<CustomResponseTyping, 'data'> & {
  data: T | null;
};

async function getTypedResponseMetadata<T>(response: Response): Promise<ResponseMetadata<T>> {
  return (await getResponseMetadata(response)) as ResponseMetadata<T>;
}

async function requireAccessToken(access_token?: string): Promise<string> {
  const token = await resolveServerAccessToken(access_token);
  if (!token) {
    throw new Error('Authentication required');
  }

  return token;
}

export async function getProducts(access_token: string): Promise<ResponseMetadata<PaymentsProductRead[]>> {
  const token = await requireAccessToken(access_token);
  const result = await fetch(
    `${getAPIUrl()}payments/products`,
    RequestBodyWithAuthHeader('GET', null, null, token),
  );
  return await getTypedResponseMetadata<PaymentsProductRead[]>(result);
}

export async function createProduct(
  data: PaymentsProductCreate,
  access_token: string,
): Promise<ResponseMetadata<PaymentsProductRead>> {
  const token = await requireAccessToken(access_token);
  const result = await fetch(
    `${getAPIUrl()}payments/products`,
    RequestBodyWithAuthHeader('POST', data, null, token),
  );
  const metadata = await getTypedResponseMetadata<PaymentsProductRead>(result);

  // Revalidate courses cache after creating product
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
  }

  return metadata;
}

export async function updateProduct(
  productId: number | string,
  data: PaymentsProductUpdate,
  access_token: string,
): Promise<ResponseMetadata<PaymentsProductRead>> {
  const token = await requireAccessToken(access_token);
  const result = await fetch(
    `${getAPIUrl()}payments/products/${productId}`,
    RequestBodyWithAuthHeader('PUT', data, null, token),
  );
  const metadata = await getTypedResponseMetadata<PaymentsProductRead>(result);

  // Revalidate courses cache after updating product
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
  }

  return metadata;
}

export async function archiveProduct(
  productId: number | string,
  access_token: string,
): Promise<ResponseMetadata<PaymentsMessageResponse>> {
  const token = await requireAccessToken(access_token);
  const result = await fetch(
    `${getAPIUrl()}payments/products/${productId}`,
    RequestBodyWithAuthHeader('DELETE', null, null, token),
  );
  const metadata = await getTypedResponseMetadata<PaymentsMessageResponse>(result);

  // Revalidate courses cache after archiving product
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
  }

  return metadata;
}

export async function getProductDetails(
  productId: number | string,
  access_token: string,
): Promise<ResponseMetadata<PaymentsProductRead>> {
  const token = await requireAccessToken(access_token);
  const result = await fetch(
    `${getAPIUrl()}payments/products/${productId}`,
    RequestBodyWithAuthHeader('GET', null, null, token),
  );
  return await getTypedResponseMetadata<PaymentsProductRead>(result);
}

export async function linkCourseToProduct(
  productId: number | string,
  courseId: number,
  access_token: string,
): Promise<ResponseMetadata<PaymentsMessageResponse>> {
  const token = await requireAccessToken(access_token);
  const result = await fetch(
    `${getAPIUrl()}payments/products/${productId}/courses/${courseId}`,
    RequestBodyWithAuthHeader('POST', null, null, token),
  );
  const metadata = await getTypedResponseMetadata<PaymentsMessageResponse>(result);

  // Revalidate courses cache after linking course to product
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
  }

  return metadata;
}

export async function unlinkCourseFromProduct(
  productId: number | string,
  courseId: number | string,
  access_token: string,
): Promise<ResponseMetadata<PaymentsMessageResponse>> {
  const token = await requireAccessToken(access_token);
  const result = await fetch(
    `${getAPIUrl()}payments/products/${productId}/courses/${courseId}`,
    RequestBodyWithAuthHeader('DELETE', null, null, token),
  );
  const metadata = await getTypedResponseMetadata<PaymentsMessageResponse>(result);

  // Revalidate courses cache after unlinking course from product
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
  }

  return metadata;
}

export async function getCoursesLinkedToProduct(
  productId: number | string,
  access_token: string,
): Promise<ResponseMetadata<CourseRead[]>> {
  const token = await requireAccessToken(access_token);
  const result = await fetch(
    `${getAPIUrl()}payments/products/${productId}/courses`,
    RequestBodyWithAuthHeader('GET', null, null, token),
  );
  return await getTypedResponseMetadata<CourseRead[]>(result);
}

export async function getProductsByCourse(
  courseId: number,
  access_token: string,
): Promise<ResponseMetadata<PaymentsProductRead[]>> {
  const token = await requireAccessToken(access_token);
  const result = await fetch(
    `${getAPIUrl()}payments/courses/${courseId}/products`,
    RequestBodyWithAuthHeader('GET', null, null, token),
  );
  return await getTypedResponseMetadata<PaymentsProductRead[]>(result);
}

export async function getStripeProductCheckoutSession(
  productId: number,
  redirect_uri: string,
  access_token: string,
): Promise<ResponseMetadata<PaymentsCheckoutSessionResponse>> {
  const token = await requireAccessToken(access_token);
  const result = await fetch(
    `${getAPIUrl()}payments/stripe/checkout/product/${productId}?redirect_uri=${redirect_uri}`,
    RequestBodyWithAuthHeader('POST', null, null, token),
  );
  return await getTypedResponseMetadata<PaymentsCheckoutSessionResponse>(result);
}
