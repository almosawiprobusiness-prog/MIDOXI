import { cn } from "@/lib/utils";

/*
  Loading skeletons.

  These are not decoration. Every page in the workspace is a server component
  that awaits its data, so without a `loading.tsx` a navigation shows the *old*
  page until the new one is ready — which reads as a click that did nothing.

  The rule they follow: a skeleton mimics the shape of what is coming, not a
  generic grey box. A stat band loads as a stat band. Getting that wrong makes
  the page appear to jump when the real content lands.
*/

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-ink-850", className)}
      aria-hidden
    />
  );
}

/** Page title + tagline, matching `PageHeader`. */
export function HeaderSkeleton() {
  return (
    <div className="mb-6 flex items-center gap-3">
      <Skeleton className="size-11 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-3.5 w-72 max-w-full" />
      </div>
    </div>
  );
}

/** The edge-to-edge KPI band, matching `StatBand`. */
export function StatBandSkeleton({ cols = 4 }: { cols?: number }) {
  const colClass =
    cols === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4";
  return (
    <div className={cn("panel grid gap-px overflow-hidden bg-line", colClass)}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="space-y-2 bg-ink-900 p-4">
          <Skeleton className="h-7 w-14" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      ))}
    </div>
  );
}

/** A divided list of rows — the most common shape in this product. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="panel divide-y divide-line">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="size-9 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-3 w-12 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function SectionLabelSkeleton() {
  return <Skeleton className="mb-3 h-2.5 w-32" />;
}

/**
 * The default workspace skeleton: a header, a stat band and two lists. Close
 * enough to every page in the product that the layout does not lurch when the
 * real content arrives.
 */
export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-6" role="status" aria-label="Loading">
      <span className="sr-only">Loading</span>
      <HeaderSkeleton />
      <div className="mb-8">
        <StatBandSkeleton />
      </div>
      <div className="mb-8">
        <SectionLabelSkeleton />
        <ListSkeleton rows={4} />
      </div>
      <div>
        <SectionLabelSkeleton />
        <ListSkeleton rows={3} />
      </div>
    </div>
  );
}
