// hooks/usePaymentsEnabled.ts

import { getPaymentConfigs } from '@services/payments/payments';
import type { components } from '@/lib/api/generated';
import useSWR from 'swr';

type PaymentsConfigRead = components['schemas']['PaymentsConfigRead'];

export function usePaymentsEnabled() {
  const { data: paymentConfigs, error, isLoading } = useSWR('/payments/config', () => getPaymentConfigs());

  const isStripeEnabled = paymentConfigs?.some(
    (config: PaymentsConfigRead) => config.provider === 'stripe' && config.active,
  );

  return {
    isEnabled: Boolean(isStripeEnabled),
    isLoading,
    error,
  };
}
