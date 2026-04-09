// hooks/usePaymentsEnabled.ts

import { useAuth } from '@/hooks/useAuth';
import { getPaymentConfigs } from '@services/payments/payments';
import type { components } from '@/lib/api/generated';
import useSWR from 'swr';

type PaymentsConfigRead = components['schemas']['PaymentsConfigRead'];

export function usePaymentsEnabled() {
  const { isAuthenticated, isLoading: sessionLoading } = useAuth();
  const {
    data: paymentConfigs,
    error,
    isLoading,
  } = useSWR(isAuthenticated ? '/payments/config' : null, () => getPaymentConfigs());

  const isStripeEnabled = paymentConfigs?.some(
    (config: PaymentsConfigRead) => config.provider === 'stripe' && config.active,
  );

  return {
    isEnabled: Boolean(isStripeEnabled),
    isLoading: sessionLoading || (isAuthenticated && isLoading),
    error,
  };
}
