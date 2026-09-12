"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiGet, apiPost } from "@/lib/api/client";
import { DATA_ONLY_TEST_NAME, isDataOnly } from "@/lib/status/exercise-validation";
import type { ActionResult } from "@/lib/forms/action-result";
import {
  relevantPipelines,
  writeSimpleConfig,
  type DeclaredVariables,
} from "@/lib/exercise-config/simple-config";
import type {
  ConfigPipelineDefinition,
  ConfigVariable,
  EnvironmentConfig,
  ExerciseConfig,
  ExerciseTest,
} from "@/lib/exercise-config/types";

import {
  configSchema,
  environmentsSchema,
  testsSchema,
  type ConfigValues,
  type EnvironmentsValues,
  type TestsValues,
} from "./exercise-config.schema";

/**
 * The three writes of the configuration screen (T-009).
 *
 * **Saving the tests can change their ids.** core-api copies a test on rename rather than
 * updating it -- `actionSetTests` implements copy-on-write and then propagates the old-to-new id
 * mapping into the configuration and the limits itself. So every one of these actions is followed
 * by a `router.refresh()` on the client: the ids the per-test form is bound to are stale the
 * moment a test is renamed, and re-reading is the only way to learn the new ones.
 *
 * **Saving the environments rewrites the configuration too**, for the same reason from the other
 * end: `actionUpdateEnvironmentConfigs` calls core-api's own `environmentsUpdated`, which adds and
 * removes whole environment branches of the configuration. Neither of those two saves sends a
 * configuration; only the third does.
 *
 * The configuration save is the one that has to be assembled, and it is assembled **from a fresh
 * read** rather than from what the page rendered with: `writeSimpleConfig` merges the form's
 * values over whatever variables are already in each pipeline, and merging over a stale copy would
 * resurrect values another tab had removed.
 *
 * None of these checks whether the caller may write. `canUpdate` gates the tests, the environments
 * and the configuration; `canSetScoreConfig` gates the score. core-api decides on every call and
 * the hints only decide what is offered (AGENTS.md constraint 4).
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("ExerciseConfig.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

export async function updateExerciseTests(
  exerciseId: string,
  values: TestsValues,
): Promise<ActionResult<{ count: number }>> {
  const t = await getTranslations("ExerciseConfig.errors");
  const parsed = testsSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  const tests = parsed.data.tests.map((test) =>
    test.id === null ? { name: test.name.trim() } : { id: test.id, name: test.name.trim() },
  );

  try {
    const saved = await apiPost<ExerciseTest[]>(
      "/v1/exercises/{id}/tests",
      { tests },
      { pathParams: { id: exerciseId } },
    );

    // The score configuration is keyed by test *name*, so it is written after the tests and from
    // the names core-api came back with -- weights for a test that was renamed in the same save
    // would otherwise be filed under a name that no longer exists.
    const savedNames = new Set(saved.map((test) => test.name));
    const testWeights: Record<string, number> = {};
    for (const test of parsed.data.tests) {
      const name = test.name.trim();
      if (savedNames.has(name)) testWeights[name] = test.weight;
    }

    await apiPost(
      "/v1/exercises/{id}/score-config",
      {
        scoreCalculator: parsed.data.calculator,
        scoreConfig: parsed.data.calculator === "weighted" ? { testWeights } : null,
      },
      { pathParams: { id: exerciseId } },
    );

    return { success: true, data: { count: saved.length } };
  } catch (error) {
    return failure(error, "testsFailed");
  }
}

export async function updateExerciseEnvironments(
  exerciseId: string,
  values: EnvironmentsValues,
): Promise<ActionResult<{ count: number }>> {
  const t = await getTranslations("ExerciseConfig.errors");
  const parsed = environmentsSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("noEnvironments") };

  try {
    // An environment that is already configured keeps its variables table; a new one starts from
    // the instance's own defaults for that language (`*.py`, `*.{cpp,h,hpp}`, ...), which is the
    // only place the glob of what a student may submit is written down.
    const [current, runtimes] = await Promise.all([
      apiGet<EnvironmentConfig[]>("/v1/exercises/{id}/environment-configs", {
        pathParams: { id: exerciseId },
      }),
      apiGet<{ id: string; defaultVariables: { name: string; type: string; value: unknown }[] }[]>(
        "/v1/runtime-environments",
      ),
    ]);

    const environmentConfigs = parsed.data.environments.map((id) => {
      const existing = current.find((entry) => entry.runtimeEnvironmentId === id);
      if (existing) return { runtimeEnvironmentId: id, variablesTable: existing.variablesTable };
      const runtime = runtimes.find((entry) => entry.id === id);
      return { runtimeEnvironmentId: id, variablesTable: runtime?.defaultVariables ?? [] };
    });

    await apiPost(
      "/v1/exercises/{id}/environment-configs",
      { environmentConfigs },
      { pathParams: { id: exerciseId } },
    );

    // **A data-only exercise gets its one test written for it** (DEC-141). core-api requires at
    // least one test of every exercise -- `ExerciseConfigChecker` has no exemption -- because a
    // test is the unit its judge runs in and the thing points hang off. For an exercise that
    // collects files rather than running code that is a formality with exactly one right answer,
    // and making a teacher discover it through a validation error is the screen failing them. The
    // guard is `length === 0`: an exercise that already has tests is somebody's own arrangement.
    if (isDataOnly(parsed.data.environments)) {
      const tests = await apiGet<ExerciseTest[]>("/v1/exercises/{id}/tests", {
        pathParams: { id: exerciseId },
      });
      if (tests.length === 0) {
        // **Not translated, and it cannot be.** core-api's test names are
        // `[-a-zA-Z0-9_()[].! ]` (`ExercisesConfigPresenter`), so the Czech "Odevzdání" was
        // refused with `test name contains illicit characters` -- found by the operator one
        // message after it shipped. A name they can change afterwards beats one that fails to be
        // created.
        await apiPost(
          "/v1/exercises/{id}/tests",
          { tests: [{ name: DATA_ONLY_TEST_NAME }] },
          { pathParams: { id: exerciseId } },
        );
      }
    }

    return { success: true, data: { count: environmentConfigs.length } };
  } catch (error) {
    return failure(error, "environmentsFailed");
  }
}

/**
 * What each pipeline of each environment declares, asked of core-api rather than assumed.
 *
 * The set of variables a pipeline's configuration entry may hold is the pipeline's, and core-api
 * refuses anything outside it -- so the writer is told rather than left to infer it from the
 * descriptor table (DEC-102, corrected after a save was refused for a variable the descriptors
 * had faithfully carried across from an older configuration).
 *
 * Asked per environment, because `/config/variables` answers for one at a time. A refusal or a
 * failure is not fatal: the writer falls back to what the form can express, which is never *more*
 * than a pipeline declares and so is safe, only occasionally incomplete.
 */
async function declaredVariables(
  exerciseId: string,
  environmentIds: string[],
  pipelines: ConfigPipelineDefinition[],
  values: { tests: { useOutFile: boolean }[] },
): Promise<DeclaredVariables> {
  const declared: DeclaredVariables = {};
  await Promise.all(
    environmentIds.map(async (environmentId) => {
      const ids = [
        ...new Set(
          values.tests.flatMap((test) =>
            relevantPipelines(pipelines, environmentId, test.useOutFile).map(
              (pipeline) => pipeline.id,
            ),
          ),
        ),
      ];
      if (ids.length === 0) return;
      try {
        const answer = await apiPost<{ id: string; variables: ConfigVariable[] }[]>(
          "/v1/exercises/{id}/config/variables",
          { runtimeEnvironmentId: environmentId, pipelinesIds: ids },
          { pathParams: { id: exerciseId } },
        );
        declared[environmentId] = Object.fromEntries(
          answer.map((entry) => [entry.id, entry.variables]),
        );
      } catch {
        // Leave this environment undeclared; the writer falls back.
      }
    }),
  );
  return declared;
}

export async function updateExerciseConfig(
  exerciseId: string,
  values: ConfigValues,
): Promise<ActionResult<{ tests: number }>> {
  const t = await getTranslations("ExerciseConfig.errors");
  const parsed = configSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  try {
    const [exercise, environments, current, pipelines] = await Promise.all([
      apiGet<{ configurationType?: string }>("/v1/exercises/{id}", {
        pathParams: { id: exerciseId },
      }),
      apiGet<EnvironmentConfig[]>("/v1/exercises/{id}/environment-configs", {
        pathParams: { id: exerciseId },
      }),
      apiGet<ExerciseConfig>("/v1/exercises/{id}/config", { pathParams: { id: exerciseId } }),
      apiGet<{ items: ConfigPipelineDefinition[] }>("/v1/pipelines"),
    ]);

    // The simple form is not rendered for an exercise built from hand-picked pipelines, and this
    // is the check that means it: core-api would accept the rewrite and the pipelines would be
    // gone. A hidden form is not a safeguard (AGENTS.md constraint 4, from the other side -- here
    // the boundary that has to hold is this app's, because core-api has no rule against it).
    // T-024's editor writes such a configuration through `updateAdvancedConfig`, which is a
    // different action for exactly this reason.
    if (exercise.configurationType === "advancedExerciseConfig") {
      return { success: false, formError: t("advancedRefused") };
    }

    const environmentIds = environments.map((entry) => entry.runtimeEnvironmentId);
    if (environmentIds.length === 0) {
      return { success: false, formError: t("noEnvironments") };
    }

    const config = writeSimpleConfig(
      parsed.data,
      environmentIds,
      pipelines.items ?? [],
      current ?? [],
      await declaredVariables(exerciseId, environmentIds, pipelines.items ?? [], parsed.data),
    );

    await apiPost("/v1/exercises/{id}/config", { config }, { pathParams: { id: exerciseId } });
    return { success: true, data: { tests: parsed.data.tests.length } };
  } catch (error) {
    return failure(error, "configFailed");
  }
}
