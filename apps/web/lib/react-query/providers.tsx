'use client';

import { HydrationBoundary, QueryClientProvider } from '@tanstack/react-query';
import type { DehydratedState } from '@tanstack/react-query';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { aiDevtoolsPlugin } from '@tanstack/react-ai-devtools';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { getQueryClient } from './queryClient';
import { useState } from 'react';
import type { ReactNode } from 'react';

interface ReactQueryProviderProps {
  children: ReactNode;
  dehydratedState?: DehydratedState;
}

export function ReactQueryProvider({ children, dehydratedState }: ReactQueryProviderProps) {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={dehydratedState}>{children}</HydrationBoundary>
      <ReactQueryDevtools initialIsOpen={false} />
      <TanStackDevtools
        plugins={[aiDevtoolsPlugin()]}
        eventBusConfig={{ connectToServerBus: true }}
      />
    </QueryClientProvider>
  );
}
