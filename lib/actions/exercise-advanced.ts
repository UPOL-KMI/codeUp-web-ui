"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiGet, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";
import {
  assembleConfig,
  writeAdvancedConfig,
  type AdvancedConfigValues,
  type PipelineVariables,
} from "@/lib/exercise-config/advanced-config";
import { descriptorsFor } from "@/lib/exercise-config/descriptors";
import { relevantPipelines, writeSimpleConfig } from "@/lib/exercise-config/simple-config";
import { readSimpleConfig } from "@/lib/exercise-config/simple-config";
import type {
  ConfigPipelineDefinition,
  ConfigVariable,
  EnvironmentConfig,
  ExerciseConfig,
  ExerciseTest,
} from "@/lib/exercise-config/types";

/**
 * The advanced configuration, and the switch between the two kinds (T-024).
 *
 * **The switch is the reason this ticket exists.** T-009 refuses to rewrite an advanced
 * configuration through the simple form, which is right -- and left an exercise in that state with
 * no way out of this app. These actions are the way out, in both directions, and each one is a
 * sequence rather than a call because core-api has no single endpoint for it:
 *
 * - **to advanced**: set `configurationType` and nothing else. The configuration already in place
 *   stays exactly as it is, and the advanced editor reads it. Nothing is lost, so nothing is asked.
 * - **to simple**: the configuration has to be rebuilt, because the simple form can only express
 *   the instance's own pipelines. The environment list is narrowed to one, the pipelines become
 *   whatever `relevantPipelines()` picks, and every variable the simple vocabulary does not know
 *   is dropped. That is a real loss, which is why the screen confirms with it named.
 *
 * **Changing the pipeline list is also a rebuild**, not a field: which variables exist depends on
 * which pipelines were chosen, so `POST /config/variables` is asked and the configuration
 * reassembled from the answer, keeping every value that still applies.
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("ExerciseAdvanced.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

interface ExercisePayload {
  version: number;
  difficulty: string;
  localizedTexts: unknown[];
  isPublic: boolean;
  isLocked: boolean;
  mergeJudgeLogs?: boolean;
  solutionFilesLimit: number | null;
  solutionSizeLimit: number | null;
  configurationType?: string;
}

const readExercise = (id: string) =>
  apiGet<ExercisePayload>("/v1/exercises/{id}", { pathParams: { id } });
const readTests = (id: string) =>
  apiGet<ExerciseTest[]>("/v1/exercises/{id}/tests", { pathParams: { id } });
const readConfig = (id: string) =>
  apiGet<ExerciseConfig>("/v1/exercises/{id}/config", { pathParams: { id } });
const readEnvironments = (id: string) =>
  apiGet<EnvironmentConfig[]>("/v1/exercises/{id}/environment-configs", { pathParams: { id } });

/** core-api replaces the exercise with what it is sent, so every field rides along (DEC-092). */
async function setConfigurationType(exerciseId: string, type: string): Promise<void> {
  const exercise = await readExercise(exerciseId);
  await apiPost(
    "/v1/exercises/{id}",
    {
      version: exercise.version,
      difficulty: exercise.difficulty,
      localizedTexts: exercise.localizedTexts,
      isPublic: exercise.isPublic,
      isLocked: exercise.isLocked,
      mergeJudgeLogs: exercise.mergeJudgeLogs ?? true,
      solutionFilesLimit: exercise.solutionFilesLimit,
      solutionSizeLimit: exercise.solutionSizeLimit,
      configurationType: type,
    },
    { pathParams: { id: exerciseId } },
  );
}

export async function askPipelineVariables(
  exerciseId: string,
  environmentId: string,
  pipelineIds: string[],
): Promise<ActionResult<PipelineVariables[]>> {
  try {
    const answer = await apiPost<PipelineVariables[]>(
      "/v1/exercises/{id}/config/variables",
      { runtimeEnvironmentId: environmentId, pipelinesIds: pipelineIds },
      { pathParams: { id: exerciseId } },
    );
    return { success: true, data: answer };
  } catch (error) {
    return failure(error, "variablesFailed");
  }
}

export async function switchToAdvancedConfig(
  exerciseId: string,
): Promise<ActionResult<{ type: string }>> {
  try {
    await setConfigurationType(exerciseId, "advancedExerciseConfig");
    return { success: true, data: { type: "advancedExerciseConfig" } };
  } catch (error) {
    return failure(error, "switchFailed");
  }
}

/**
 * Back to the simple kind. The order matters and is core-api's, not a preference: the environment
 * list has to be narrowed **first**, because `environmentsUpdated` rewrites the configuration
 * itself, and only then can a simple configuration be written over the result.
 */
export async function switchToSimpleConfig(
  exerciseId: string,
): Promise<ActionResult<{ type: string }>> {
  const t = await getTranslations("ExerciseAdvanced.errors");
  try {
    const [environments, tests, pipelines] = await Promise.all([
      readEnvironments(exerciseId),
      readTests(exerciseId),
      apiGet<{ items: ConfigPipelineDefinition[] }>("/v1/pipelines"),
    ]);

    const environmentId = environments[0]?.runtimeEnvironmentId;
    if (!environmentId) return { success: false, formError: t("noEnvironment") };

    // One environment only: an advanced configuration has exactly one, and a simple one built from
    // the others would have nothing in it.
    await apiPost(
      "/v1/exercises/{id}/environment-configs",
      {
        environmentConfigs: [
          { runtimeEnvironmentId: environmentId, variablesTable: environments[0]!.variablesTable },
        ],
      },
      { pathParams: { id: exerciseId } },
    );

    const current = await readConfig(exerciseId);
    const values = readSimpleConfig(current ?? [], tests, [environmentId]);

    // The pipelines the simple form would use, and what each of them declares -- core-api refuses
    // a configuration holding anything else, and an advanced one routinely holds more.
    const chosen = [
      ...new Set(
        values.tests.flatMap((test) =>
          relevantPipelines(pipelines.items ?? [], environmentId, test.useOutFile).map(
            (pipeline) => pipeline.id,
          ),
        ),
      ),
    ];
    const declared = await apiPost<{ id: string; variables: ConfigVariable[] }[]>(
      "/v1/exercises/{id}/config/variables",
      { runtimeEnvironmentId: environmentId, pipelinesIds: chosen },
      { pathParams: { id: exerciseId } },
    );

    await apiPost(
      "/v1/exercises/{id}/config",
      {
        config: writeSimpleConfig(values, [environmentId], pipelines.items ?? [], current ?? [], {
          [environmentId]: Object.fromEntries(declared.map((entry) => [entry.id, entry.variables])),
        }),
      },
      { pathParams: { id: exerciseId } },
    );

    await setConfigurationType(exerciseId, "simpleExerciseConfig");
    return { success: true, data: { type: "simpleExerciseConfig" } };
  } catch (error) {
    return failure(error, "switchFailed");
  }
}

/** Which pipelines an advanced configuration uses. Changing them reassembles it. */
export async function setAdvancedPipelines(
  exerciseId: string,
  pipelineIds: string[],
): Promise<ActionResult<{ count: number }>> {
  const t = await getTranslations("ExerciseAdvanced.errors");
  if (pipelineIds.length === 0) return { success: false, formError: t("noPipelines") };

  try {
    const [environments, tests, current] = await Promise.all([
      readEnvironments(exerciseId),
      readTests(exerciseId),
      readConfig(exerciseId),
    ]);
    const environmentId = environments[0]?.runtimeEnvironmentId;
    if (!environmentId) return { success: false, formError: t("noEnvironment") };

    const declared = await apiPost<PipelineVariables[]>(
      "/v1/exercises/{id}/config/variables",
      { runtimeEnvironmentId: environmentId, pipelinesIds: pipelineIds },
      { pathParams: { id: exerciseId } },
    );

    await apiPost(
      "/v1/exercises/{id}/config",
      { config: assembleConfig(current ?? [], environmentId, tests, declared) },
      { pathParams: { id: exerciseId } },
    );
    return { success: true, data: { count: pipelineIds.length } };
  } catch (error) {
    return failure(error, "pipelinesFailed");
  }
}

/** The environment of an advanced configuration, and its hand-written variables table. */
export async function setAdvancedEnvironment(
  exerciseId: string,
  environmentId: string,
  variablesTable: ConfigVariable[],
): Promise<ActionResult<{ id: string }>> {
  const t = await getTranslations("ExerciseAdvanced.errors");
  if (!environmentId) return { success: false, formError: t("noEnvironment") };

  try {
    await apiPost(
      "/v1/exercises/{id}/environment-configs",
      { environmentConfigs: [{ runtimeEnvironmentId: environmentId, variablesTable }] },
      { pathParams: { id: exerciseId } },
    );

    // Changing the environment invalidates every variable the pipelines declared for the old one,
    // so the configuration is reassembled rather than left pointing at a language that is gone.
    const [tests, current] = await Promise.all([readTests(exerciseId), readConfig(exerciseId)]);
    const pipelineIds = (current?.[0]?.tests[0]?.pipelines ?? []).map((pipeline) => pipeline.name);
    if (pipelineIds.length > 0) {
      const declared = await apiPost<PipelineVariables[]>(
        "/v1/exercises/{id}/config/variables",
        { runtimeEnvironmentId: environmentId, pipelinesIds: pipelineIds },
        { pathParams: { id: exerciseId } },
      );
      await apiPost(
        "/v1/exercises/{id}/config",
        { config: assembleConfig(current ?? [], environmentId, tests, declared) },
        { pathParams: { id: exerciseId } },
      );
    }
    return { success: true, data: { id: environmentId } };
  } catch (error) {
    return failure(error, "environmentFailed");
  }
}

export async function updateAdvancedConfig(
  exerciseId: string,
  values: AdvancedConfigValues,
): Promise<ActionResult<{ tests: number }>> {
  try {
    await apiPost(
      "/v1/exercises/{id}/config",
      { config: writeAdvancedConfig(values) },
      { pathParams: { id: exerciseId } },
    );
    return { success: true, data: { tests: values.tests.length } };
  } catch (error) {
    return failure(error, "configFailed");
  }
}

/**
 * What switching back to the simple kind would cost, worked out before it is done.
 *
 * The simple form has a fixed vocabulary (`descriptorsFor`), so any variable in the advanced
 * configuration outside it is dropped on the way back, along with every pipeline that is not one
 * `relevantPipelines()` would pick. "Something may be lost" is not a warning anybody can act on;
 * these two lists are.
 */
export interface SwitchPreview {
  droppedVariables: string[];
  droppedPipelines: string[];
  environments: string[];
}

export async function previewSwitchToSimple(
  exerciseId: string,
): Promise<ActionResult<SwitchPreview>> {
  try {
    const [environments, current, pipelines] = await Promise.all([
      readEnvironments(exerciseId),
      readConfig(exerciseId),
      apiGet<{ items: ConfigPipelineDefinition[] }>("/v1/pipelines"),
    ]);

    const environmentIds = environments.map((entry) => entry.runtimeEnvironmentId);
    const environmentId = environmentIds[0] ?? "";
    const known = new Set<string>();
    for (const descriptor of descriptorsFor(environmentIds)) {
      known.add(descriptor.variable);
      if (descriptor.namesVariable) known.add(descriptor.namesVariable);
    }

    const kept = new Set(
      relevantPipelines(pipelines.items ?? [], environmentId, false)
        .concat(relevantPipelines(pipelines.items ?? [], environmentId, true))
        .map((pipeline) => pipeline.id),
    );
    const names = new Map((pipelines.items ?? []).map((entry) => [entry.id, entry.name]));

    const droppedVariables = new Set<string>();
    const droppedPipelines = new Set<string>();
    for (const environment of current ?? []) {
      for (const test of environment.tests) {
        for (const pipeline of test.pipelines) {
          if (!kept.has(pipeline.name)) {
            droppedPipelines.add(names.get(pipeline.name) ?? pipeline.name);
          }
          for (const variable of pipeline.variables) {
            if (!known.has(variable.name)) droppedVariables.add(variable.name);
          }
        }
      }
    }

    return {
      success: true,
      data: {
        droppedVariables: [...droppedVariables].sort(),
        droppedPipelines: [...droppedPipelines].sort(),
        environments: environmentIds,
      },
    };
  } catch (error) {
    return failure(error, "switchFailed");
  }
}
