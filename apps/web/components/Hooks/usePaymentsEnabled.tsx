// hooks/usePaymentsEnabled.ts

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { getPaymentConfigs } from '@services/payments/payments';
import type { components } from '@/lib/api/generated';
import { queryKeys } from '@/lib/react-query/queryKeys';

type PaymentsConfigRead = components['schemas']['PaymentsConfigRead'];

export function usePaymentsEnabled() {
  const { isAuthenticated } = useAuth();
  const query = useQuery({
    queryKey: queryKeys.payments.config(),
    queryFn: () => getPaymentConfigs(),
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
