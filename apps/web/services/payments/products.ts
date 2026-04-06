'use server';
import { getResponseMetadata } from '@services/utils/ts/requests';
import { apiFetch } from '@/lib/api-client';
import type { CustomResponseTyping } from '@services/utils/ts/requests';
import type { components } from '@/lib/api/generated';
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

export async function getProducts(): Promise<ResponseMetadata<PaymentsProductRead[]>> {
  const result = await apiFetch('payments/products');
  return await getTypedResponseMetadata<PaymentsProductRead[]>(result);
}

export async function createProduct(data: PaymentsProductCreate): Promise<ResponseMetadata<PaymentsProductRead>> {
  const result = await apiFetch('payments/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const metadata = await getTypedResponseMetadata<PaymentsProductRead>(result);

  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
  }

  return metadata;
}

export async function updateProduct(
  productId: number | string,
  data: PaymentsProductUpdate,
): Promise<ResponseMetadata<PaymentsProductRead>> {
  const result = await apiFetch(`payments/products/${productId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const metadata = await getTypedResponseMetadata<PaymentsProductRead>(result);

  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
  }

  return metadata;
}

export async function archiveProduct(productId: number | string): Promise<ResponseMetadata<PaymentsMessageResponse>> {
  const result = await apiFetch(`payments/products/${productId}`, { method: 'DELETE' });
  const metadata = await getTypedResponseMetadata<PaymentsMessageResponse>(result);

  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
  }

  return metadata;
}

export async function getProductDetails(productId: number | string): Promise<ResponseMetadata<PaymentsProductRead>> {
  const result = await apiFetch(`payments/products/${productId}`);
  return await getTypedResponseMetadata<PaymentsProductRead>(result);
}

export async function linkCourseToProduct(
  productId: number | string,
  courseId: number,
): Promise<ResponseMetadata<PaymentsMessageResponse>> {
  const result = await apiFetch(`payments/products/${productId}/courses/${courseId}`, { method: 'POST' });
  const metadata = await getTypedResponseMetadata<PaymentsMessageResponse>(result);

  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
  }

  return metadata;
}

export async function unlinkCourseFromProduct(
  productId: number | string,
  courseId: number | string,
): Promise<ResponseMetadata<PaymentsMessageResponse>> {
  const result = await apiFetch(`payments/products/${productId}/courses/${courseId}`, { method: 'DELETE' });
  const metadata = await getTypedResponseMetadata<PaymentsMessageResponse>(result);

  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.courses, 'max');
  }

  return metadata;
}

export async function getCoursesLinkedToProduct(productId: number | string): Promise<ResponseMetadata<CourseRead[]>> {
  const result = await apiFetch(`payments/products/${productId}/courses`);
  return await getTypedResponseMetadata<CourseRead[]>(result);
}

export async function getProductsByCourse(courseId: number): Promise<ResponseMetadata<PaymentsProductRead[]>> {
  const result = await apiFetch(`payments/courses/${courseId}/products`);
  return await getTypedResponseMetadata<PaymentsProductRead[]>(result);
}

export async function getStripeProductCheckoutSession(
  productId: number,
  redirect_uri: string,
): Promise<ResponseMetadata<PaymentsCheckoutSessionResponse>> {
  const result = await apiFetch(`payments/stripe/checkout/product/${productId}?redirect_uri=${redirect_uri}`, {
    method: 'POST',
  });
  return await getTypedResponseMetadata<PaymentsCheckoutSessionResponse>(result);
}
