import type {
  ConfigEnvironment,
  ConfigPipeline,
  ConfigVariable,
  ExerciseConfig,
  ExerciseTest,
} from "./types";

/**
 * The *other* kind of exercise configuration (T-024): the one built from hand-picked pipelines.
 *
 * T-009 edits the simple kind, where the instance's pipelines are chosen for the exercise and each
 * variable goes wherever a pipeline declares it. An `advancedExerciseConfig` inverts that: the
 * author picks the pipelines, and then fills in **every variable those pipelines ask for**, by
 * hand, per test. It is what somebody reaches for when their exercise does not fit the standard
 * shape at all -- a custom judge chain, a two-stage build, a language the simple form has no
 * vocabulary for.
 *
 * Three rules make it a different thing rather than a superset, and all three come from core-api:
 *
 * - **exactly one runtime environment**, because the pipeline list is fixed and a second language
 *   would need its own;
 * - **the same pipelines for every test**, in the same order -- `getPipelines` reads them off the
 *   first test of the first environment and the rest are assumed to match, which is what core-api
 *   writes and what `assembleConfig` here reproduces;
 * - **which variables exist is not a guess**: `POST /exercises/{id}/config/variables` answers, for
 *   a given environment and pipeline list, exactly what has to be filled in. That endpoint is the
 *   whole reason this editor can exist without a copy of the pipeline vocabulary.
 */
export interface PipelineVariables {
  id: string;
  variables: ConfigVariable[];
}

/** The pipelines an advanced configuration uses, in order. */
export function configuredPipelines(config: ExerciseConfig): string[] {
  return (config[0]?.tests[0]?.pipelines ?? []).map((pipeline) => pipeline.name);
}

/** The one environment an advanced configuration is for. */
export function configuredEnvironment(config: ExerciseConfig): string | null {
  return config[0]?.name ?? null;
}

function variablesOf(
  config: ExerciseConfig,
  environmentId: string,
  testId: string,
  index: number,
  pipelineId: string,
): ConfigVariable[] | null {
  const environment = config.find((entry) => entry.name === environmentId);
  const test = environment?.tests.find((entry) => String(entry.name) === testId);
  const pipeline: ConfigPipeline | undefined = test?.pipelines[index];
  return pipeline && pipeline.name === pipelineId ? pipeline.variables : null;
}

/**
 * What is already set, filled out with the defaults the pipelines declare. A variable whose stored
 * type no longer matches the pipeline's is **discarded rather than coerced**: a `string` where a
 * `string[]` is now wanted is not a value that means anything, and keeping it would send core-api
 * something it will refuse with a message about a variable the author cannot see.
 */
function merge(stored: ConfigVariable[] | null, declared: ConfigVariable[]): ConfigVariable[] {
  if (!stored) return declared.map((variable) => ({ ...variable }));
  const byName = new Map(stored.map((variable) => [variable.name, variable]));
  return declared.map((variable) => {
    const existing = byName.get(variable.name);
    return existing && existing.type === variable.type ? { ...existing } : { ...variable };
  });
}

export interface AdvancedTestValues {
  id: string;
  /** One entry per configured pipeline, in the pipeline list's own order. */
  pipelines: { id: string; variables: ConfigVariable[] }[];
}

export interface AdvancedConfigValues {
  environmentId: string;
  tests: AdvancedTestValues[];
}

export function readAdvancedConfig(
  config: ExerciseConfig,
  tests: ExerciseTest[],
  environmentId: string,
  pipelines: PipelineVariables[],
): AdvancedConfigValues {
  return {
    environmentId,
    tests: tests.map((test) => ({
      id: String(test.id),
      pipelines: pipelines.map((pipeline, index) => ({
        id: pipeline.id,
        variables: merge(
          variablesOf(config, environmentId, String(test.id), index, pipeline.id),
          pipeline.variables,
        ),
      })),
    })),
  };
}

export function writeAdvancedConfig(values: AdvancedConfigValues): ExerciseConfig {
  const environment: ConfigEnvironment = {
    name: values.environmentId,
    tests: values.tests.map((test) => ({
      name: Number(test.id),
      pipelines: test.pipelines.map((pipeline) => ({
        name: pipeline.id,
        variables: pipeline.variables.map((variable) => ({ ...variable })),
      })),
    })),
  };
  return [environment];
}

/**
 * The configuration to write when the **pipeline list or the environment changes** -- as much of
 * the old one as still applies, and the pipelines' own defaults for everything new. Separate from
 * `writeAdvancedConfig` because it is what happens on a structural change rather than on a save of
 * the values, and core-api has no call that does it: the client assembles the whole thing.
 */
export function assembleConfig(
  previous: ExerciseConfig,
  environmentId: string,
  tests: ExerciseTest[],
  pipelines: PipelineVariables[],
): ExerciseConfig {
  return writeAdvancedConfig(readAdvancedConfig(previous, tests, environmentId, pipelines));
}

/**
 * Which variable names the *environment's* own table may sensibly define -- the file-typed
 * variables the chosen pipelines mention, with how many of them mention each.
 *
 * An environment configuration in the advanced kind is a free table of variables, and that freedom
 * is the trap: a name nothing reads does nothing at all, silently. So the editor offers the names
 * that would actually be picked up, and lets anything else be typed.
 */
export function possibleEnvironmentVariables(
  pipelines: { id: string; pipeline?: { variables?: ConfigVariable[] } }[],
  selected: string[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of selected) {
    const pipeline = pipelines.find((entry) => entry.id === id);
    for (const variable of pipeline?.pipeline?.variables ?? []) {
      if (variable.type !== "file" && variable.type !== "file[]") continue;
      counts[variable.name] = (counts[variable.name] ?? 0) + 1;
    }
  }
  return counts;
}
