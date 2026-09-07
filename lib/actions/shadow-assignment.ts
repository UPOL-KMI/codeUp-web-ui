"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiDelete, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

import { shadowAssignmentSchema, type ShadowAssignmentValues } from "./shadow-assignment.schema";

/**
 * Bringing a shadow assignment into existence, changing it and removing it (G-009).
 *
 * S-020 built reading one and T-024 the points awarded against it; the entity's own lifecycle was
 * never built, so **`scripts/seed.ts` was its only user interface** -- the seed creates them by raw
 * API call because no screen could.
 *
 * None of these checks whether the caller may act: the group's `createShadowAssignment`, and the
 * assignment's `update` and `remove`, are core-api's call on every request (brief §6).
 *
 * No `revalidatePath` (DEC-021): every read is `no-store`, and callers refresh the router.
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("Shadow.edit.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

/**
 * A new shadow assignment in a group.
 *
 * Takes nothing but the group, because that is all core-api's `actionCreate` accepts -- it builds
 * an empty one and hands it back. DEC-093's shape for the third time, and here it is not even a
 * choice: there is no call that creates a configured shadow assignment. core-api refuses an
 * organizational group outright, and that message is worth forwarding rather than pre-empting,
 * since it is the same rule F-029 records from the other side.
 */
export async function createShadowAssignment(
  groupId: string,
): Promise<ActionResult<{ shadowId: string }>> {
  try {
    const created = await apiPost<{ id: string }>("/v1/shadow-assignments", { groupId });
    return { success: true, data: { shadowId: created.id } };
  } catch (error) {
    return failure(error, "createFailed");
  }
}

/**
 * Everything about a shadow assignment its author decides.
 *
 * **One form and one save, because core-api replaces the assignment with what it is sent** -- the
 * same shape T-002 found for real assignments (DEC-092), and the same consequence: a field omitted
 * is a field reset, and a **locale omitted is a locale deleted**. `version` rides along as the
 * optimistic lock and its `400-010` is surfaced verbatim rather than retried, because the honest
 * answer to "someone else saved first" is to reload and look at what changed.
 *
 * Locales with no name are dropped rather than saved empty -- core-api refuses an empty collection,
 * and a shadow assignment named in one language only is how the seed's own two are shaped.
 */
export async function updateShadowAssignment(
  shadowId: string,
  version: number,
  values: ShadowAssignmentValues,
): Promise<ActionResult<{ shadowId: string }>> {
  const t = await getTranslations("Shadow.edit.errors");
  const parsed = shadowAssignmentSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  try {
    await apiPost(
      "/v1/shadow-assignments/{id}",
      {
        version,
        maxPoints: parsed.data.maxPoints,
        isBonus: parsed.data.isBonus,
        isPublic: parsed.data.isPublic,
        deadline: parsed.data.deadline,
        sendNotification: parsed.data.sendNotification,
        localizedTexts: parsed.data.texts
          .filter((text) => text.name.trim() !== "")
          .map((text) => ({
            locale: text.locale,
            name: text.name,
            text: text.text,
            // core-api validates a link only when it is non-empty, and stores null for the rest.
            ...(text.link !== "" && { link: text.link }),
          })),
      },
      { pathParams: { id: shadowId } },
    );
    return { success: true, data: { shadowId } };
  } catch (error) {
    return failure(error, "saveFailed");
  }
}

/** Remove a shadow assignment. Every points record awarded against it goes with it. */
export async function deleteShadowAssignment(
  shadowId: string,
): Promise<ActionResult<{ shadowId: string }>> {
  try {
    await apiDelete("/v1/shadow-assignments/{id}", { pathParams: { id: shadowId } });
    return { success: true, data: { shadowId } };
  } catch (error) {
    return failure(error, "deleteFailed");
  }
}
