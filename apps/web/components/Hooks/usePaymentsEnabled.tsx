// hooks/usePaymentsEnabled.ts

import { useAuth } from '@/hooks/useAuth';
import type { components } from '@/lib/api/generated';
import { usePaymentConfigs } from '@/features/payments/hooks/usePayments';

type PaymentsConfigRead = components['schemas']['PaymentsConfigRead'];

export function usePaymentsEnabled() {
  const { isAuthenticated } = useAuth();
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
