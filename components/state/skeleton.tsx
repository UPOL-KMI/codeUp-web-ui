/**
 * Loading placeholders (D-008). Brief §9: "loading (skeletons via `loading.tsx`, not a spinner in
 * the void)" -- a skeleton that matches the shape of what's coming also prevents the layout shift
 * the same section forbids, which a centred spinner cannot.
 *
 * `data-slot="skeleton"` is the hook `app/globals.css` uses to stop the pulse under
 * `prefers-reduced-motion` -- an indefinitely repeating animation is exactly what that preference
 * is about, more so than a one-shot dialog transition.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      data-slot="skeleton"
      aria-hidden="true"
      className={`block animate-pulse rounded-md bg-muted ${className ?? ""}`}
    />
  );
}

/**
 * Table-shaped skeleton, sized to `DataTable`'s own rows so the real table doesn't jump when it
 * arrives. Marked `aria-busy` on a `role="status"` region rather than left silent: a screen-reader
 * user gets "loading" instead of a wall of nothing.
 */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-2">
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-2">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton key={column} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Page-shaped skeleton: the header block plus a table. What a route's `loading.tsx` renders. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-64" />
      </div>
      <TableSkeleton />
    </div>
  );
}
