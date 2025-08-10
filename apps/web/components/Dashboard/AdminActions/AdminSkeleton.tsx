'use client';

import { Card, CardContent, CardHeader } from '@components/ui/card';
import { Skeleton } from '@components/ui/skeleton';
import { cn } from '@/lib/utils';

interface AdminSkeletonProps {
  variant?: 'overview' | 'analytics' | 'charts' | 'table' | 'card-grid' | 'navigation';
  count?: number;
  className?: string;
}

const AdminSkeleton = ({ variant = 'overview', count = 1, className }: AdminSkeletonProps) => {
  switch (variant) {
    case 'navigation': {
      return (
        <div className={cn('space-y-6 p-6', className)}>
          {/* Header Skeleton */}
          <div className="space-y-2 text-center">
            <Skeleton className="mx-auto h-8 w-48" />
            <Skeleton className="mx-auto h-4 w-64" />
          </div>

          {/* Quick Stats Skeleton */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card
                key={i}
                className="p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
              </Card>
            ))}
          </div>

          {/* Navigation Grid Skeleton */}
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(9)].map((_, i) => (
                <Card
                  key={i}
                  className="p-4"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      );
    }

    case 'analytics': {
      return (
        <div className={cn('space-y-6 px-6', className)}>
          {/* Charts Grid Skeleton */}
          <div className="gap-6">
            {[...Array(2)].map((_, i) => (
              <Card
                key={i}
                className="mb-4 w-full"
              >
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5" />
                    <Skeleton className="h-6 w-32" />
                  </div>
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-48 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      );
    }

    case 'charts': {
      return (
        <div className={cn('space-y-6 p-6', className)}>
          {[...Array(count)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-5" />
                      <Skeleton className="h-6 w-40" />
                    </div>
                    <Skeleton className="h-4 w-56" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {[...Array(3)].map((_, j) => (
                      <div
                        key={j}
                        className="space-y-2 text-center"
                      >
                        <Skeleton className="mx-auto h-8 w-16" />
                        <Skeleton className="mx-auto h-4 w-20" />
                      </div>
                    ))}
                  </div>
                  <Skeleton className="h-48 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    case 'table': {
      return (
        <div className={cn('space-y-4 p-6', className)}>
          {/* Search and Filters */}
          <div className="flex gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>

          {/* Table Headers */}
          <Card>
            <CardContent className="p-0">
              <div className="border-b p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>

              {/* Table Rows */}
              {[...Array(count || 5)].map((_, i) => (
                <div
                  key={i}
                  className="border-b p-4 last:border-b-0"
                >
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-4" />
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-8 w-8"
                />
              ))}
            </div>
          </div>
        </div>
      );
    }

    case 'card-grid': {
      return (
        <div className={cn('grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3', className)}>
          {[...Array(count || 6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Skeleton className="h-32 w-full" />
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }
    default: {
      return (
        <div className={cn('space-y-6 p-6', className)}>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
            <div className="flex gap-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-8 w-12"
                />
              ))}
            </div>
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-12 w-12 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {[...Array(count || 2)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5" />
                    <Skeleton className="h-6 w-32" />
                  </div>
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[...Array(3)].map((_, j) => (
                      <div
                        key={j}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-8 w-8 rounded-full" />
                          <div className="space-y-1">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                        <div className="space-y-1 text-right">
                          <Skeleton className="h-4 w-12" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      );
    }
  }
};

export { AdminSkeleton };
