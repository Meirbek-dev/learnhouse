'use client';

import type { ReactNode } from 'react';

const ClientComponentSkeleton = ({ children }: { children: ReactNode }) => {
  return <div>{children}</div>;
};

export default ClientComponentSkeleton;
