'use client';

import { queryOptions, useQuery } from '@tanstack/react-query';
import {
  courseAccessQueryOptions,
  courseProductsQueryOptions,
  ownedCoursesQueryOptions,
  paymentConfigsQueryOptions,
  paymentCustomersQueryOptions,
  paymentProductsQueryOptions,
  productCoursesQueryOptions,
  stripeConnectionQueryOptions,
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

function courseAccessHookOptions(courseId: number | null | undefined, enabled = true) {
  const normalizedCourseId = courseId ?? 0;

  return queryOptions({
    ...courseAccessQueryOptions(normalizedCourseId),
    enabled: enabled && Boolean(courseId),
  });
}

function stripeConnectionHookOptions(code: string | null | undefined, enabled = true) {
  const normalizedCode = code?.trim() ?? '';

  return queryOptions({
    ...stripeConnectionQueryOptions(normalizedCode || '__disabled__'),
    enabled: enabled && normalizedCode.length > 0,
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

export function useCoursePaidAccess(courseId: number | null | undefined, options?: { enabled?: boolean }) {
  return useQuery(courseAccessHookOptions(courseId, options?.enabled ?? true));
}

export function useOwnedCourses() {
  return useQuery(ownedCoursesQueryOptions());
}

export function useStripeConnectionVerification(code: string | null | undefined, options?: { enabled?: boolean }) {
  return useQuery(stripeConnectionHookOptions(code, options?.enabled ?? true));
}
