import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface SkeletonProps {
  title?: string;
}

export function ProfileSkeleton({ title }: SkeletonProps) {
  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="flex items-start gap-4">
          <Skeleton className="h-20 w-20 rounded-full shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3 w-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatsSkeleton({ title }: SkeletonProps) {
  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function LeaderboardSkeleton({ title, itemCount = 5 }: SkeletonProps & { itemCount?: number }) {
  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-3">
          {[...Array(itemCount)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-6 w-6 shrink-0" />
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-6 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ActivityFeedSkeleton({ title, itemCount = 5 }: SkeletonProps & { itemCount?: number }) {
  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-4">
          {[...Array(itemCount)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-12 shrink-0" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
