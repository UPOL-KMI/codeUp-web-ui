"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

import { solutionPointsSchema, type SolutionPointsValues } from "./solution-verdict.schema";

/**
 * The teacher's verdict on a solution (G-001): which attempt counts, and what it is worth.
 *
 * Both of these were reachable in the legacy app and in neither case did this app offer them --
 * the accepted badge was rendered on four screens and nothing could set it. Neither checks whether
 * the caller may act: `setFlag` and `setBonusPoints` are core-api's call on every request, and a
 * Server Action is a public HTTP endpoint whatever the UI rendered (brief §6).
 *
 * No `revalidatePath` (DEC-021): every read is `no-store`, so callers refresh the router.
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("Solution.verdict.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

/**
 * Accept this attempt as the one that counts, or take that back.
 *
 * **Accepting is exclusive and core-api enforces it**, not this app: `actionSetFlag` treats
 * `accepted` as a unique flag, so it clears it from every other solution the same author submitted
 * to the same assignment before setting it here. The confirmation says so, because "accept" reads
 * like an addition and is in fact a move.
 */
export async function setSolutionAccepted(
  solutionId: string,
  value: boolean,
): Promise<ActionResult<{ solutionId: string }>> {
  try {
    await apiPost(
      "/v1/assignment-solutions/{id}/set-flag/{flag}",
      { value },
      { pathParams: { id: solutionId, flag: "accepted" } },
    );
    return { success: true, data: { solutionId } };
  } catch (error) {
    return failure(error, "acceptFailed");
  }
}

/**
 * Award points the pipeline did not, or clear the award.
 *
 * `overriddenPoints` is sent as a **string, or null to clear** -- core-api's own shape, and its
 * source carries three TODOs apologising for it: `Validators::isNumericInt` decides whether to set
 * the override, `empty()` decides whether to clear it, and anything else is a 400. A number sent as
 * JSON `null` arrives as an empty value and clears, which is the behaviour this relies on and which
 * was confirmed against the live instance rather than read.
 */
export async function setSolutionPoints(
  solutionId: string,
  values: SolutionPointsValues,
): Promise<ActionResult<{ solutionId: string }>> {
  const t = await getTranslations("Solution.verdict.errors");
  const parsed = solutionPointsSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  try {
    await apiPost(
      "/v1/assignment-solutions/{id}/bonus-points",
      {
        bonusPoints: parsed.data.bonusPoints,
        overriddenPoints:
          parsed.data.overriddenPoints === null ? null : String(parsed.data.overriddenPoints),
      },
      { pathParams: { id: solutionId } },
    );
    return { success: true, data: { solutionId } };
  } catch (error) {
    return failure(error, "pointsFailed");
  }
}
