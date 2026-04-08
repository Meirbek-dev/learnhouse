// hooks/usePaymentsEnabled.ts

import { useSession } from '@/components/Contexts/SessionProvider';
import { getPaymentConfigs } from '@services/payments/payments';
import type { components } from '@/lib/api/generated';
import useSWR from 'swr';

type PaymentsConfigRead = components['schemas']['PaymentsConfigRead'];

export function usePaymentsEnabled() {
  const session = useSession();
  const isAuthenticated = session.status === 'authenticated' && Boolean(session.data?.user);
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
    isLoading: session.isLoading || (isAuthenticated && isLoading),
    error,
  };
}
