// hooks/usePaymentsEnabled.ts

import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { getPaymentConfigs } from '@services/payments/payments';
import type { components } from '@/lib/api/generated';
import useSWR from 'swr';

type PaymentsConfigRead = components['schemas']['PaymentsConfigRead'];

export function usePaymentsEnabled() {
  const session = usePlatformSession();
  const isAuthenticated = session.status === 'authenticated' && Boolean(session.data?.user);
  const { data: paymentConfigs, error, isLoading } = useSWR(
    isAuthenticated ? '/payments/config' : null,
    () => getPaymentConfigs(),
  );

  const isStripeEnabled = paymentConfigs?.some(
    (config: PaymentsConfigRead) => config.provider === 'stripe' && config.active,
  );

  return {
    isEnabled: Boolean(isStripeEnabled),
    isLoading: session.isLoading || (isAuthenticated && isLoading),
    error,
  };
}
