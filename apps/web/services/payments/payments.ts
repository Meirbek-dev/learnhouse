'use server';
import { RequestBodyWithAuthHeader, errorHandling } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { tags } from '@/lib/cacheTags';

export async function getPaymentConfigs(orgId: number, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}payments/${orgId}/config`,
    RequestBodyWithAuthHeader('GET', null, null, access_token),
  );
  return await errorHandling(result);
}

export async function checkPaidAccess(courseId: number, orgId: number, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}payments/${orgId}/courses/${courseId}/access`,
    RequestBodyWithAuthHeader('GET', null, null, access_token),
  );
  return await errorHandling(result);
}

export async function initializePaymentConfig(orgId: number, data: any, provider: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}payments/${orgId}/config?provider=${provider}`,
    RequestBodyWithAuthHeader('POST', data, null, access_token),
  );
  const responseData = await errorHandling(result);

  // Revalidate organizations cache after initializing payment config
  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.organizations, 'max');
  }

  return responseData;
}

export async function updatePaymentConfig(orgId: number, id: string, data: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}payments/${orgId}/config?id=${id}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token),
  );
  const responseData = await errorHandling(result);

  // Revalidate organizations cache after updating payment config
  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.organizations, 'max');
  }

  return responseData;
}

export async function updateStripeAccountID(orgId: number, data: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}payments/${orgId}/stripe/account?stripe_account_id=${data.stripe_account_id}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token),
  );
  const responseData = await errorHandling(result);

  // Revalidate organizations cache after updating Stripe account
  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.organizations, 'max');
  }

  return responseData;
}

export async function getStripeOnboardingLink(orgId: number, access_token: string, redirect_uri: string) {
  const result = await fetch(
    `${getAPIUrl()}payments/${orgId}/stripe/connect/link?redirect_uri=${redirect_uri}`,
    RequestBodyWithAuthHeader('POST', null, null, access_token),
  );
  return await errorHandling(result);
}

export async function verifyStripeConnection(orgId: number, code: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}payments/stripe/oauth/callback?code=${code}&org_id=${orgId}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token),
  );
  return await errorHandling(result);
}

export async function deletePaymentConfig(orgId: number, id: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}payments/${orgId}/config?id=${id}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token),
  );
  const responseData = await errorHandling(result);

  // Revalidate organizations cache after deleting payment config
  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.organizations, 'max');
  }

  return responseData;
}

export async function getOrgCustomers(orgId: number, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}payments/${orgId}/customers`,
    RequestBodyWithAuthHeader('GET', null, null, access_token),
  );
  return await errorHandling(result);
}

export async function getOwnedCourses(orgId: number, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}payments/${orgId}/courses/owned`,
    RequestBodyWithAuthHeader('GET', null, null, access_token),
  );
  return await errorHandling(result);
}
