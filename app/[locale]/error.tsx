"use client";

import { useTranslations } from "next-intl";

// Error boundaries must be Client Components. `retry` (stable since 16.3.0) re-fetches and
// re-renders the boundary's children, including failed Server Components -- prefer it over
// `reset`, which only clears local state without re-fetching. This is the route-segment
// convention; component-level boundaries elsewhere in the tree use next/error's catchError
// instead (see AGENTS.md footgun 8) -- not needed here, error.tsx already gets a boundary
// built in.
export default function Error({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("Error");

  return (
    <main>
      <h1>{t("title")}</h1>
      <button onClick={() => retry()}>{t("retry")}</button>
    </main>
  );
}
