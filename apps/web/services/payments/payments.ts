'use server';
import { errorHandling, getResponseMetadata } from '@services/utils/ts/requests';
import { apiFetch } from '@/lib/api-client';
import type { CustomResponseTyping } from '@services/utils/ts/requests';
import type { components } from '@/lib/api/generated';
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

interface PaymentsConfigCreateInput {
  provider: PaymentProviderEnum;
  enabled: boolean;
  active?: boolean;
  provider_config?: Record<string, unknown>;
  provider_specific_id?: string | null;
}

interface StripeAccountInput {
  stripe_account_id: string;
}

async function getTypedResponseMetadata<T>(response: Response): Promise<ResponseMetadata<T>> {
  return (await getResponseMetadata(response)) as ResponseMetadata<T>;
}

export async function getPaymentConfigs(): Promise<PaymentsConfigRead[]> {
  const result = await apiFetch('payments/config');
  return (await errorHandling(result)) as PaymentsConfigRead[];
}

export async function checkPaidAccess(courseId: number): Promise<PaymentsCourseAccessResponse> {
  const result = await apiFetch(`payments/courses/${courseId}/access`);
  return (await errorHandling(result)) as PaymentsCourseAccessResponse;
}

export async function initializePaymentConfig(
  _data: PaymentsConfigCreateInput,
  provider: Extract<PaymentProviderEnum, 'stripe'>,
): Promise<PaymentsConfig> {
  const result = await apiFetch(`payments/config?provider=${provider}`, { method: 'POST' });
  const data = (await errorHandling(result)) as PaymentsConfig;

  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.platform, 'max');
  }

  return data;
}

export async function updatePaymentConfig(id: number | string, data: PaymentsConfigUpdate): Promise<PaymentsConfig> {
  const result = await apiFetch(`payments/config?id=${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const responseData = (await errorHandling(result)) as PaymentsConfig;

  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.platform, 'max');
  }

  return responseData;
}

export async function updateStripeAccountID(data: StripeAccountInput): Promise<PaymentsMessageResponse> {
  const result = await apiFetch(`payments/stripe/account?stripe_account_id=${data.stripe_account_id}`, {
    method: 'PUT',
  });
  const responseData = (await errorHandling(result)) as PaymentsMessageResponse;

  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.platform, 'max');
  }

  return responseData;
}

export async function getStripeOnboardingLink(redirect_uri: string): Promise<PaymentsConnectLinkResponse> {
  const result = await apiFetch(`payments/stripe/connect/link?redirect_uri=${redirect_uri}`, { method: 'POST' });
  return (await errorHandling(result)) as PaymentsConnectLinkResponse;
}

export async function verifyStripeConnection(code: string): Promise<PaymentsStripeOAuthCallbackResponse> {
  const result = await apiFetch(`payments/stripe/oauth/callback?code=${code}`);
  return (await errorHandling(result)) as PaymentsStripeOAuthCallbackResponse;
}

export async function deletePaymentConfig(id: number | string): Promise<PaymentsMessageResponse> {
  const result = await apiFetch(`payments/config?id=${id}`, { method: 'DELETE' });
  const responseData = (await errorHandling(result)) as PaymentsMessageResponse;

  if (result.ok) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.platform, 'max');
  }

  return responseData;
}

export async function getCustomers(): Promise<PaymentsCustomerRead[]> {
  const result = await apiFetch('payments/customers');
  return (await errorHandling(result)) as PaymentsCustomerRead[];
}

export async function getOwnedCourses(): Promise<CourseRead[]> {
  const result = await apiFetch('payments/courses/owned');
  return (await errorHandling(result)) as CourseRead[];
}
