"use client";

import { useSyncExternalStore } from "react";
import { useFormatter } from "next-intl";

/**
 * Relative time ("in 3 days", "2 hours ago") -- D-012's client-side half.
 *
 * **Client-only by necessity, not by preference.** A relative time is a function of *now*, so the
 * server's answer and the browser's differ by however long the response took, and any cached HTML
 * is wrong the moment it is reused. AGENTS.md §6.6 names this exact case ("relative times... must
 * render client-side or use a stable absolute format on the server"). Same `useSyncExternalStore`
 * shape as `DeadlineBadge`: the server snapshot is `null`, so React reconciles the difference
 * without a hydration warning instead of it being papered over.
 *
 * The absolute value is always rendered too, as the `<time>` element's `dateTime` and its native
 * tooltip -- "in 3 days" is friendlier but a student deciding whether to start work tonight needs
 * the actual timestamp, and a screen reader gets the ISO value regardless of whether the relative
 * text has resolved yet.
 */
const subscribe = () => () => {};

export function RelativeTime({ unixSeconds }: { unixSeconds: number }) {
  const format = useFormatter();
  const date = new Date(unixSeconds * 1000);

  const relative = useSyncExternalStore(
    subscribe,
    () => format.relativeTime(date, new Date()),
    () => null,
  );

  return (
    <time dateTime={date.toISOString()} title={date.toISOString()} className="whitespace-nowrap">
      {relative}
    </time>
  );
}
