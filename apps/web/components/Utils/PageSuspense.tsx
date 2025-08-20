import type { ReactNode } from 'react';
import { Suspense } from 'react';

interface LoadingSkeletonProps {
  className?: string;
}

export function LoadingSkeleton({ className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`animate-pulse ${className}`}>
      <div className="mb-2 h-4 rounded-md bg-gray-200" />
      <div className="mb-2 h-4 w-3/4 rounded-md bg-gray-200" />
      <div className="h-4 w-1/2 rounded-md bg-gray-200" />
    </div>
  );
}

interface PageSkeletonProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function PageSuspense({ children, fallback }: PageSkeletonProps) {
  return <Suspense fallback={fallback || <LoadingSkeleton className="p-6" />}>{children}</Suspense>;
}
