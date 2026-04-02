// hooks/usePaymentsEnabled.ts

import type { components } from '@/lib/api/generated';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { getPaymentConfigs } from '@services/payments/payments';
import useSWR from 'swr';

type PaymentsConfigRead = components['schemas']['PaymentsConfigRead'];

export function usePaymentsEnabled() {
  const session = usePlatformSession();
  const access_token = session?.data?.tokens?.access_token;

  const {
    data: paymentConfigs,
    error,
    isLoading,
  } = useSWR(access_token ? ['/payments/config', access_token] : null, ([_url, token]) => getPaymentConfigs(token));

  const isStripeEnabled = paymentConfigs?.some((config: PaymentsConfigRead) => config.provider === 'stripe' && config.active);

  return {
    isEnabled: Boolean(isStripeEnabled),
    isLoading,
    error,
  };
}
