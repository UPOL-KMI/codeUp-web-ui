import "server-only";

import { apiGet } from "./client";
import { pageRead } from "./read";
import type { HardwareGroup, StoredLimits } from "@/lib/exercise-config/limits";
import type { EnvironmentConfig, ExerciseTest } from "@/lib/exercise-config/types";

/**
 * What the limits screen reads (T-010).
 *
 * The limits themselves come keyed by hardware group, and core-api only ever names the groups the
 * **exercise** runs on -- so an exercise with no hardware group has an empty object rather than a
 * missing one, which is exactly the `@no-hwgroups` state that keeps a freshly configured exercise
 * from being assignable. The instance's full list is read separately, because choosing one is the
 * first thing this screen does.
 */
export interface ExerciseLimitsData {
  limits: StoredLimits;
  /** Every hardware group the instance has. */
  available: HardwareGroup[];
  /** The ones this exercise runs on, in the instance's own order. */
  selected: HardwareGroup[];
  tests: ExerciseTest[];
  environmentIds: string[];
}

export async function getExerciseLimitsData(exerciseId: string): Promise<ExerciseLimitsData> {
  const [limits, available, tests, environments] = await Promise.all([
    pageRead(apiGet<StoredLimits>("/v1/exercises/{id}/limits", { pathParams: { id: exerciseId } })),
    apiGet<HardwareGroup[]>("/v1/hardware-groups"),
    apiGet<ExerciseTest[]>("/v1/exercises/{id}/tests", { pathParams: { id: exerciseId } }),
    apiGet<EnvironmentConfig[]>("/v1/exercises/{id}/environment-configs", {
      pathParams: { id: exerciseId },
    }),
  ]);

  const chosen = new Set(Object.keys(limits));
  return {
    limits,
    available,
    selected: available.filter((group) => chosen.has(group.id)),
    tests: [...tests].sort((a, b) => a.name.localeCompare(b.name)),
    environmentIds: environments.map((entry) => entry.runtimeEnvironmentId),
  };
}
