// hooks/usePaymentsEnabled.ts

import { useSession } from '@/hooks/useSession';
import type { components } from '@/lib/api/generated';
import { usePaymentConfigs } from '@/features/payments/hooks/usePayments';

type PaymentsConfigRead = components['schemas']['PaymentsConfigRead'];

export function usePaymentsEnabled() {
  const { isAuthenticated } = useSession();
  const query = usePaymentConfigs({ enabled: isAuthenticated });

  const isStripeEnabled = query.data?.some(
    (config: PaymentsConfigRead) => config.provider === 'stripe' && config.active,
  );

  return {
    isEnabled: Boolean(isStripeEnabled),
    isLoading: isAuthenticated && query.isPending,
    error: query.error,
  };
}
