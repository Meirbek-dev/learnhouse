'use client';

import { getCustomers, getOwnedCourses, getPaymentConfigs } from '@services/payments/payments';
import { getCoursesLinkedToProduct, getProducts, getProductsByCourse } from '@services/payments/products';
import { queryOptions } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/queryKeys';

export function paymentConfigsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.payments.config(),
    queryFn: () => getPaymentConfigs(),
  });
}

export function paymentCustomersQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.payments.customers(),
    queryFn: () => getCustomers(),
  });
}

export function paymentProductsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.payments.products(),
    queryFn: () => getProducts(),
  });
}

export function productCoursesQueryOptions(productId: number | string) {
  return queryOptions({
    queryKey: queryKeys.payments.productCourses(productId),
    queryFn: () => getCoursesLinkedToProduct(productId),
  });
}

export function courseProductsQueryOptions(courseId: number) {
  return queryOptions({
    queryKey: queryKeys.payments.courseProducts(courseId),
    queryFn: () => getProductsByCourse(courseId),
  });
}

export function ownedCoursesQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.payments.ownedCourses(),
    queryFn: () => getOwnedCourses(),
    staleTime: 60_000,
  });
}
