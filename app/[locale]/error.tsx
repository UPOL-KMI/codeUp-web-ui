"use client";

import { ErrorState } from "@/components/state/error-state";

// Error boundaries must be Client Components. `retry` (stable since 16.3.0) re-fetches and
// re-renders the boundary's children, including failed Server Components -- prefer it over
// `reset`, which only clears local state without re-fetching. This is the route-segment
// convention; a *component*-level boundary elsewhere in the tree uses D-008's <ErrorBoundary>
// (next/error's catchError, AGENTS.md footgun 8) -- not needed here, error.tsx already gets a
// boundary built in. All the presentation lives in <ErrorState> so a panel-level failure and a
// whole-route failure look like the same product.
export default function Error({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <ErrorState retry={retry} />
    </main>
  );
}
