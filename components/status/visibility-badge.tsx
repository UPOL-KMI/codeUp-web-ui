"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "./badge";

/**
 * Whether an assignment is visible to students *now* -- the three states core-api's own rule has
 * (`Assignment::isVisibleToStudents`: `isPublic && (visibleFrom === null || visibleFrom <= now)`).
 *
 * **A Client Component for the same reason `DeadlineBadge` is**, and it was written because the
 * badge beside it was not one: "published" was rendered as *Viditelné* even while the release time
 * was still minutes away, with the release time printed next to it saying otherwise. Whether that
 * moment has passed depends on the clock, and a server render freezes an answer that is wrong by
 * the time anybody reads it. The server snapshot is `null`, so the badge appears a frame late
 * rather than appearing wrong.
 *
 * Deliberately not on a ticking interval, again like the deadline badge: a badge that flips while
 * the page sits open is a claim about a page that is no longer being looked at. A reload tells the
 * truth, and core-api decides who may actually see the assignment regardless of what this says.
 */
export type VisibilityState = "hidden" | "scheduled" | "visible";

function stateFor(now: number, isPublic: boolean, visibleFrom: number | null): VisibilityState {
  if (!isPublic) return "hidden";
  return visibleFrom !== null && visibleFrom > now ? "scheduled" : "visible";
}

const TONE = { hidden: "warning", scheduled: "warning", visible: "success" } as const;

const subscribe = () => () => {};

export function VisibilityBadge({
  isPublic,
  visibleFrom,
  hideWhenVisible,
}: {
  isPublic: boolean;
  /** Unix seconds, or null for "as soon as it is published". */
  visibleFrom: number | null;
  /**
   * Say nothing for an assignment students can already see. In a list, "visible" is the ordinary
   * case and a badge on every row is noise; on a screen *about* one assignment it is the answer to
   * a question the reader asked, so it is said there.
   */
  hideWhenVisible?: boolean;
}) {
  const t = useTranslations("Assignment.visibilityState");
  const state = useSyncExternalStore(
    subscribe,
    () => stateFor(Date.now() / 1000, isPublic, visibleFrom),
    () => null,
  );

  if (!state) return null;
  if (hideWhenVisible && state === "visible") return null;

  return <Badge tone={TONE[state]}>{t(state)}</Badge>;
}
