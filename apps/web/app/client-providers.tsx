'use client';

import StyledComponentsRegistry from '../components/Utils/libs/styled-registry';
import LHSessionProvider from '@components/Contexts/LHSessionContext';
import { SessionProvider } from 'next-auth/react';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface ClientProvidersProps {
  children: ReactNode;
}

const variants = {
  hidden: { opacity: 0 },
  enter: { opacity: 1 },
  exit: { opacity: 0 },
} as const;

const pageTransition = {
  type: 'tween' as const,
  ease: 'linear' as const,
  duration: 0.3,
} as const;

export default function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <SessionProvider
      refetchInterval={60_000}
      refetchOnWindowFocus
      refetchWhenOffline={false}
    >
      <LHSessionProvider>
        <StyledComponentsRegistry>
          <motion.main
            variants={variants}
            initial="hidden"
            animate="enter"
            exit="exit"
            transition={pageTransition}
          >
            {children}
          </motion.main>
        </StyledComponentsRegistry>
      </LHSessionProvider>
    </SessionProvider>
  );
}
