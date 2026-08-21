"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "./badge";

/**
 * Deadline state for an assignment (D-011).
 *
 * **A Client Component on purpose, and it deliberately renders nothing on the server.** Whether a
 * deadline has passed depends on the current time, and the server's answer and the browser's
 * answer are not the same value -- rendering it server-side is precisely the hydration mismatch
 * AGENTS.md §6.6 calls out ("ReCodEx is full of deadlines -- this will bite otherwise"). Rendering
 * after mount is the honest version: the badge appears a frame late rather than appearing wrong.
 * Deliberately not on a ticking interval either -- a deadline badge that silently flips while the
 * page sits open would be a lie the moment the user acts on it, and the submit path is authorised
 * by core-api regardless of what this badge says.
 * The absolute deadline itself is safe to render on the server, and D-012's formatters own that.
 *
 * The three states mirror the legacy app's `pastDeadline` (0 / 1 / 2): before the first deadline,
 * between the two (submissions still accepted, reduced points), and past everything.
 */
export interface DeadlineBadgeProps {
  /** Unix seconds, as core-api returns them. */
  firstDeadline: number;
  secondDeadline?: number | null;
  allowSecondDeadline?: boolean;
}

type DeadlineState = "open" | "second-chance" | "closed";

function stateFor(
  now: number,
  { firstDeadline, secondDeadline, allowSecondDeadline }: DeadlineBadgeProps,
): DeadlineState {
  if (now < firstDeadline) return "open";
  if (allowSecondDeadline && secondDeadline && now < secondDeadline) return "second-chance";
  return "closed";
}

const TONE = { open: "success", "second-chance": "warning", closed: "neutral" } as const;

// `useSyncExternalStore` is the primitive React provides for exactly this shape of problem: a
// value that legitimately differs between the server render and the client. The server snapshot is
// `null` (the server has no business deciding whether a deadline has passed), the client snapshot
// is the real state, and React reconciles the two without a hydration warning. The obvious
// alternative -- `useState` plus an effect that sets it after mount -- is both a hydration hazard
// worked around by hand and a `setState` inside an effect, which this repo's lint config rejects
// on sight (and has now been right about three times).
const subscribe = () => () => {};

export function DeadlineBadge(props: DeadlineBadgeProps) {
  const t = useTranslations("Status");
  const state = useSyncExternalStore(
    subscribe,
    () => stateFor(Date.now() / 1000, props),
    () => null,
  );

  if (!state) return null;

  return <Badge tone={TONE[state]}>{t(`deadline.${state}`)}</Badge>;
}
