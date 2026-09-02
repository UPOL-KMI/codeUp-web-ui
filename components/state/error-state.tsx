"use client";

import { useTranslations } from "next-intl";

import { StatusState, type StatusStateProps } from "./status-state";

/**
 * The error state with its retry (D-008). Brief §9: "every error state has a retry" -- and §6.8 is
 * specific that the retry is Next's own `retry()`, which re-fetches and re-renders the boundary's
 * children including failed Server Components, not a bespoke client-side refetch and not `reset()`
 * (which only clears local state without re-fetching -- confirmed in the installed
 * `catchError` docs, `next/dist/docs/.../catchError.md`).
 *
 * Deliberately does **not** render `error.message`. Core-api errors are already normalised
 * elsewhere (`ApiError`'s `code`/`message`, `lib/api/client.ts`), and an unhandled server error's
 * raw message is either a stack-adjacent internal string or, in production, Next's redacted
 * placeholder -- neither is something to show a student. `digest` is logged by Next itself for
 * correlation; if a screen ever needs to surface an identifier to quote in a bug report, that is
 * the thing to add here, not the message.
 */
export function ErrorState({
  retry,
  description,
  headingLevel,
}: {
  retry: () => void;
  description?: string;
  /** See `StatusState` -- a boundary nested inside a section that already has a heading. */
  headingLevel?: StatusStateProps["headingLevel"];
}) {
  const t = useTranslations("Error");

  return (
    <StatusState
      tone="danger"
      title={t("title")}
      description={description ?? t("description")}
      headingLevel={headingLevel}
      action={
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("retry")}
        </button>
      }
    />
  );
}
