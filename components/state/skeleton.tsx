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
 * arrives. Every bar is `aria-hidden`, so `role="status"` is applied only when the caller passes a
 * `label` for it to read: a live region over nothing but hidden bars announces silence, which is
 * the defect rather than the fix. This file is server-safe and synchronous and so has no translator
 * of its own -- an async Server Component rendering it as a `Suspense` fallback can pass one, and a
 * `loading.tsx`, which must be synchronous, cannot.
 */
export function TableSkeleton({
  rows = 5,
  columns = 4,
  label,
}: {
  rows?: number;
  columns?: number;
  label?: string;
}) {
  return (
    <div role={label ? "status" : undefined} className="flex flex-col gap-2">
      {label && <span className="sr-only">{label}</span>}
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
export function PageSkeleton({ label }: { label?: string }) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-64" />
      </div>
      <TableSkeleton label={label} />
    </div>
  );
}
