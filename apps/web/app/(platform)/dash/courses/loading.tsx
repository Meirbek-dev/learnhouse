'use client';

export default function CoursesLoading() {
  return (
    <div className="space-y-8 px-4 py-6 lg:px-8">
      <div className="space-y-3">
        <div className="h-10 w-72 animate-pulse rounded-lg bg-muted" />
        <div className="h-5 w-full max-w-2xl animate-pulse rounded bg-muted/80" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border bg-card p-5 shadow-sm"
          >
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-9 w-16 animate-pulse rounded bg-muted/80" />
            <div className="mt-3 h-4 w-40 animate-pulse rounded bg-muted/60" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="h-10 w-full max-w-md animate-pulse rounded-lg bg-muted" />
          <div className="flex gap-3">
            <div className="h-10 w-32 animate-pulse rounded-lg bg-muted" />
            <div className="h-10 w-40 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-2xl border bg-card shadow-sm"
          >
            <div className="aspect-[16/9] animate-pulse bg-muted" />
            <div className="space-y-4 p-5">
              <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted/80" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-muted/70" />
              <div className="flex gap-2">
                <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
                <div className="h-6 w-16 animate-pulse rounded-full bg-muted/80" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
