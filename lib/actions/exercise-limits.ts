"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiGet, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";
import {
  limitsConstraints,
  validateLimits,
  writeLimits,
  type HardwareGroup,
} from "@/lib/exercise-config/limits";
import type { EnvironmentConfig, ExerciseTest } from "@/lib/exercise-config/types";

import {
  hardwareGroupsSchema,
  limitsSchema,
  type HardwareGroupsValues,
  type LimitsFormValues,
} from "./exercise-limits.schema";

/**
 * The two writes of the limits screen (T-010).
 *
 * **Choosing the hardware groups rewrites the configuration**, not just a list: core-api's
 * `hwGroupsUpdated` adds and removes whole branches of the limits, and clearing the list leaves an
 * exercise that cannot be assigned (`@no-hwgroups`). So it is its own save, and the page refreshes
 * after it.
 *
 * **The limits are validated here as well as in the form**, against the ceilings of the groups the
 * exercise actually runs on -- read fresh, not taken from the client. core-api validates too, but
 * it reports the first cell it dislikes as a sentence about a hardware group, and a grid needs to
 * be told which cells rather than which one.
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("ExerciseLimits.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

export async function updateExerciseHardwareGroups(
  exerciseId: string,
  values: HardwareGroupsValues,
): Promise<ActionResult<{ count: number }>> {
  const t = await getTranslations("ExerciseLimits.errors");
  const parsed = hardwareGroupsSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  try {
    await apiPost(
      "/v1/exercises/{id}/hardware-groups",
      { hwGroups: parsed.data.hardwareGroups },
      { pathParams: { id: exerciseId } },
    );
    return { success: true, data: { count: parsed.data.hardwareGroups.length } };
  } catch (error) {
    return failure(error, "hardwareGroupsFailed");
  }
}

export async function updateExerciseLimits(
  exerciseId: string,
  values: LimitsFormValues,
): Promise<ActionResult<{ cells: number }>> {
  const t = await getTranslations("ExerciseLimits.errors");
  const parsed = limitsSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  try {
    const [groups, tests, environments, current] = await Promise.all([
      apiGet<HardwareGroup[]>("/v1/hardware-groups"),
      apiGet<ExerciseTest[]>("/v1/exercises/{id}/tests", { pathParams: { id: exerciseId } }),
      apiGet<EnvironmentConfig[]>("/v1/exercises/{id}/environment-configs", {
        pathParams: { id: exerciseId },
      }),
      apiGet<Record<string, unknown>>("/v1/exercises/{id}/limits", {
        pathParams: { id: exerciseId },
      }),
    ]);

    if (!Object.hasOwn(current, parsed.data.hardwareGroupId)) {
      return { success: false, formError: t("unknownHardwareGroup") };
    }

    const testIds = tests.map((test) => String(test.id));
    const environmentIds = environments.map((entry) => entry.runtimeEnvironmentId);
    const exerciseGroups = groups.filter((group) => Object.hasOwn(current, group.id));

    const problems = validateLimits(
      parsed.data,
      limitsConstraints(exerciseGroups, parsed.data.preciseTime),
      testIds,
      environmentIds,
    );
    if (problems.length > 0) return { success: false, formError: t("outOfRange") };

    await apiPost(
      "/v1/exercises/{id}/limits",
      { limits: writeLimits(parsed.data, parsed.data.hardwareGroupId, testIds, environmentIds) },
      { pathParams: { id: exerciseId } },
    );
    return { success: true, data: { cells: testIds.length * environmentIds.length } };
  } catch (error) {
    return failure(error, "limitsFailed");
  }
}
