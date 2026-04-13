'use client';

import { HydrationBoundary, QueryClientProvider } from '@tanstack/react-query';
import type { DehydratedState } from '@tanstack/react-query';
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
      {process.env.NODE_ENV === 'development' && <DevtoolsPanel />}
    </QueryClientProvider>
  );
}

function DevtoolsPanel() {
  const { ReactQueryDevtools } = require('@tanstack/react-query-devtools');
  const { TanStackDevtools } = require('@tanstack/react-devtools');
  const { aiDevtoolsPlugin } = require('@tanstack/react-ai-devtools');

  return (
    <>
      <ReactQueryDevtools initialIsOpen={false} />
      <TanStackDevtools
        plugins={[aiDevtoolsPlugin()]}
        eventBusConfig={{ connectToServerBus: true }}
      />
    </>
  );
}
