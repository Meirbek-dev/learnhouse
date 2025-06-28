'use client';
import { motion } from 'framer-motion';
import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

import LHSessionProvider from '@components/Contexts/LHSessionContext';
import StyledComponentsRegistry from '../components/Utils/libs/styled-registry';

interface ClientLayoutProps {
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

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <SessionProvider
      refetchInterval={0} // Disable auto-refetch to reduce noise
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      <LHSessionProvider>
        <StyledComponentsRegistry>
          <motion.main
            variants={variants} // Pass the variant object into Framer Motion
            initial="hidden" // Set the initial state to variants.hidden
            animate="enter" // Animated state to variants.enter
            exit="exit" // Exit state (used later) to variants.exit
            transition={pageTransition} // Set the transition to linear
          >
            {children}
          </motion.main>
        </StyledComponentsRegistry>
      </LHSessionProvider>
    </SessionProvider>
  );
}
