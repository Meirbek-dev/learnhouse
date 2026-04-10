'use client';

import { queryOptions, useQuery } from '@tanstack/react-query';
import {
  courseProductsQueryOptions,
  ownedCoursesQueryOptions,
  paymentConfigsQueryOptions,
  paymentCustomersQueryOptions,
  paymentProductsQueryOptions,
  productCoursesQueryOptions,
} from '../queries/payments.query';

function paymentConfigsHookOptions(enabled = true) {
  return queryOptions({
    ...paymentConfigsQueryOptions(),
    enabled,
  });
}

function productCoursesHookOptions(productId: number | string | null | undefined) {
  const normalizedProductId = productId ?? '';

  return queryOptions({
    ...productCoursesQueryOptions(normalizedProductId),
    enabled: Boolean(productId),
  });
}

function courseProductsHookOptions(courseId: number | null | undefined) {
  const normalizedCourseId = courseId ?? 0;

  return queryOptions({
    ...courseProductsQueryOptions(normalizedCourseId),
    enabled: Boolean(courseId),
  });
}

export function usePaymentConfigs(options?: { enabled?: boolean }) {
  return useQuery(paymentConfigsHookOptions(options?.enabled ?? true));
}

export function usePaymentCustomers() {
  return useQuery(paymentCustomersQueryOptions());
}

export function usePaymentProducts() {
  return useQuery(paymentProductsQueryOptions());
}

export function useProductCourses(productId: number | string | null | undefined) {
  return useQuery(productCoursesHookOptions(productId));
}

export function useCourseProducts(courseId: number | null | undefined) {
  return useQuery(courseProductsHookOptions(courseId));
}

export function useOwnedCourses() {
  return useQuery(ownedCoursesQueryOptions());
}
