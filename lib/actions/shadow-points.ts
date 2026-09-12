"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiDelete, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

import { shadowPointsSchema, type ShadowPointsValues } from "./shadow-points.schema";

/**
 * Awarding, changing and withdrawing the points of a shadow assignment (S-020) -- the only kind of
 * points in ReCodEx that a person types in rather than a pipeline computing.
 *
 * core-api's `canCreatePoints` / `canUpdatePoints` / `canRemovePoints` decide who may, on every
 * call; the hints only decide what the UI offers (brief §6). No `revalidatePath` (DEC-021): every
 * read is `no-store`, and the caller refreshes the router.
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("Shadow.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

function body(values: ShadowPointsValues) {
  return {
    points: values.points,
    note: values.note,
    ...(values.awardedAt !== null && { awardedAt: values.awardedAt }),
  };
}

export async function awardShadowPoints(
  shadowId: string,
  userId: string,
  values: ShadowPointsValues,
): Promise<ActionResult<{ userId: string }>> {
  const t = await getTranslations("Shadow.errors");
  const parsed = shadowPointsSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  try {
    await apiPost(
      "/v1/shadow-assignments/{id}/create-points",
      { userId, ...body(parsed.data) },
      { pathParams: { id: shadowId } },
    );
    return { success: true, data: { userId } };
  } catch (error) {
    return failure(error, "awardFailed");
  }
}

export async function updateShadowPoints(
  pointsId: string,
  values: ShadowPointsValues,
): Promise<ActionResult<{ pointsId: string }>> {
  const t = await getTranslations("Shadow.errors");
  const parsed = shadowPointsSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  try {
    await apiPost("/v1/shadow-assignments/points/{pointsId}", body(parsed.data), {
      pathParams: { pointsId },
    });
    return { success: true, data: { pointsId } };
  } catch (error) {
    return failure(error, "awardFailed");
  }
}

export async function removeShadowPoints(
  pointsId: string,
): Promise<ActionResult<{ pointsId: string }>> {
  try {
    await apiDelete("/v1/shadow-assignments/points/{pointsId}", { pathParams: { pointsId } });
    return { success: true, data: { pointsId } };
  } catch (error) {
    return failure(error, "removeFailed");
  }
}
