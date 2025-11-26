import type { ReactNode } from 'react';

/**
 * Legacy wrapper component - kept for backwards compatibility.
 * This is now a server component (no client JS shipped).
 */
const ClientComponentSkeleton = ({ children }: { children: ReactNode }) => {
  return <div>{children}</div>;
};

export default ClientComponentSkeleton;
