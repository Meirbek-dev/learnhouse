'use server';
import {
  type CustomResponseTyping,
  RequestBodyWithAuthHeader,
  errorHandling,
  getResponseMetadata,
} from '@services/utils/ts/requests';
import type { components } from '@/lib/api/generated';
import { getAPIUrl } from '@services/config/config';
import { tags } from '@/lib/cacheTags';

type CourseRead = components['schemas']['CourseRead'];
type PaymentProviderEnum = components['schemas']['PaymentProviderEnum'];
type PaymentsConfig = components['schemas']['PaymentsConfig'];
type PaymentsConfigRead = components['schemas']['PaymentsConfigRead'];
type PaymentsConfigUpdate = components['schemas']['PaymentsConfigUpdate'];
type PaymentsConnectLinkResponse = components['schemas']['PaymentsConnectLinkResponse'];
type PaymentsCourseAccessResponse = components['schemas']['PaymentsCourseAccessResponse'];
type PaymentsCustomerRead = components['schemas']['PaymentsCustomerRead'];
type PaymentsMessageResponse = components['schemas']['PaymentsMessageResponse'];
type PaymentsStripeOAuthCallbackResponse = components['schemas']['PaymentsStripeOAuthCallbackResponse'];

type ResponseMetadata<T> = Omit<CustomResponseTyping, 'data'> & {
  data: T | null;
};

type PaymentsConfigCreateInput = {
  provider: PaymentProviderEnum;
  enabled: boolean;
  active?: boolean;
  provider_config?: Record<string, unknown>;
  provider_specific_id?: string | null;
};

type StripeAccountInput = {
  stripe_account_id: string;
};

async function getTypedResponseMetadata<T>(response: Response): Promise<ResponseMetadata<T>> {
  return (await getResponseMetadata(response)) as ResponseMetadata<T>;
}

export async function getPaymentConfigs(access_token: string): Promise<PaymentsConfigRead[]> {
  const result = await fetch(
    `${getAPIUrl()}payments/config`,
    RequestBodyWithAuthHeader('GET', null, null, access_token),
  );
  return (await errorHandling(result)) as PaymentsConfigRead[];
}

export async function checkPaidAccess(courseId: number, access_token: string): Promise<PaymentsCourseAccessResponse> {
  const result = await fetch(
    `${getAPIUrl()}payments/courses/${courseId}/access`,
    RequestBodyWithAuthHeader('GET', null, null, access_token),
  );
  return (await errorHandling(result)) as PaymentsCourseAccessResponse;
}

export async function initializePaymentConfig(
  _data: PaymentsConfigCreateInput,
  provider: Extract<PaymentProviderEnum, 'stripe'>,
  access_token: string,
): Promise<PaymentsConfig> {
  const result = await fetch(
    `${getAPIUrl()}payments/config?provider=${provider}`,
    RequestBodyWithAuthHeader('POST', null, null, access_token),
  );
  const responseData = (await errorHandling(result)) as PaymentsConfig;

  // Revalidate platform cache after initializing payment config
  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.platform, 'max');
  }

  return responseData;
}

export async function updatePaymentConfig(
  id: number | string,
  data: PaymentsConfigUpdate,
  access_token: string,
): Promise<PaymentsConfig> {
  const result = await fetch(
    `${getAPIUrl()}payments/config?id=${id}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token),
  );
  const responseData = (await errorHandling(result)) as PaymentsConfig;

  // Revalidate platform cache after updating payment config
  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.platform, 'max');
  }

  return responseData;
}

export async function updateStripeAccountID(
  data: StripeAccountInput,
  access_token: string,
): Promise<PaymentsMessageResponse> {
  const result = await fetch(
    `${getAPIUrl()}payments/stripe/account?stripe_account_id=${data.stripe_account_id}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token),
  );
  const responseData = (await errorHandling(result)) as PaymentsMessageResponse;

  // Revalidate platform cache after updating Stripe account
  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.platform, 'max');
  }

  return responseData;
}

export async function getStripeOnboardingLink(
  access_token: string,
  redirect_uri: string,
): Promise<PaymentsConnectLinkResponse> {
  const result = await fetch(
    `${getAPIUrl()}payments/stripe/connect/link?redirect_uri=${redirect_uri}`,
    RequestBodyWithAuthHeader('POST', null, null, access_token),
  );
  return (await errorHandling(result)) as PaymentsConnectLinkResponse;
}

export async function verifyStripeConnection(
  code: string,
  access_token: string,
): Promise<PaymentsStripeOAuthCallbackResponse> {
  const result = await fetch(
    `${getAPIUrl()}payments/stripe/oauth/callback?code=${code}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token),
  );
  return (await errorHandling(result)) as PaymentsStripeOAuthCallbackResponse;
}

export async function deletePaymentConfig(id: number | string, access_token: string): Promise<PaymentsMessageResponse> {
  const result = await fetch(
    `${getAPIUrl()}payments/config?id=${id}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token),
  );
  const responseData = (await errorHandling(result)) as PaymentsMessageResponse;

  // Revalidate platform cache after deleting payment config
  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.platform, 'max');
  }

  return responseData;
}

export async function getCustomers(access_token: string): Promise<PaymentsCustomerRead[]> {
  const result = await fetch(
    `${getAPIUrl()}payments/customers`,
    RequestBodyWithAuthHeader('GET', null, null, access_token),
  );
  return (await errorHandling(result)) as PaymentsCustomerRead[];
}

export async function getOwnedCourses(access_token: string): Promise<CourseRead[]> {
  const result = await fetch(
    `${getAPIUrl()}payments/courses/owned`,
    RequestBodyWithAuthHeader('GET', null, null, access_token),
  );
  return (await errorHandling(result)) as CourseRead[];
}
