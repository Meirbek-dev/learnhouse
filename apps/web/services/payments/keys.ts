import { getAPIUrl } from '@services/config/config';

export function getPaymentsProductsSwrKey(orgId: number | null | undefined) {
  if (!orgId) return '';
  return `${getAPIUrl()}payments/${orgId}/products`;
}

export function getProductLinkedCoursesSwrKey(orgId: number | null | undefined, productId: string | null | undefined) {
  if (!orgId || !productId) return '';
  return `${getAPIUrl()}payments/${orgId}/products/${productId}/courses`;
}

export function getPaymentsConfigSwrKey(orgId: number | null | undefined) {
  if (!orgId) return '';
  return `${getAPIUrl()}payments/${orgId}/config`;
}

export function getPaymentsCustomersSwrKey(orgId: number | null | undefined) {
  if (!orgId) return '';
  return `${getAPIUrl()}payments/${orgId}/customers`;
}
