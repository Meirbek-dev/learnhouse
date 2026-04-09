// hooks/usePaymentsEnabled.ts

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { components } from '@/lib/api/generated';
import { paymentConfigsQueryOptions } from '@/features/payments/queries/payments.query';

type PaymentsConfigRead = components['schemas']['PaymentsConfigRead'];

export function usePaymentsEnabled() {
  const { isAuthenticated } = useAuth();
  const query = useQuery({
    ...paymentConfigsQueryOptions(),
    enabled: isAuthenticated,
  });

  const isStripeEnabled = query.data?.some(
    (config: PaymentsConfigRead) => config.provider === 'stripe' && config.active,
  );

  return {
    isEnabled: Boolean(isStripeEnabled),
    isLoading: isAuthenticated && query.isPending,
    error: query.error,
  };
}
