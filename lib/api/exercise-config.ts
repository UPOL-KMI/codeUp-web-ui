import "server-only";

import { ApiError, apiGet } from "./client";
import { pageRead } from "./read";
import { getRuntimeEnvironments } from "./runtime-environments";
import type {
  ConfigPipelineDefinition,
  EnvironmentConfig,
  ExerciseConfig,
  ExerciseTest,
} from "@/lib/exercise-config/types";
import { SIMPLE_FORM_ENVIRONMENTS } from "@/lib/exercise-config/environments";

/**
 * Everything the configuration screen reads (T-009). Five calls, because core-api keeps an
 * exercise's configuration in five places and none of them is reachable from another: the tests,
 * the score calculator, the environment configurations, the configuration proper, and the
 * instance's pipeline catalogue.
 *
 * **The tests and the score configuration are read even when the configuration itself is
 * refused.** `viewConfig` and `viewScoreConfig` are separate hints and a reader can hold one
 * without the other, so a refusal on one part leaves the rest of the screen standing rather than
 * taking the page down -- the shape T-021 already uses for an exercise's files.
 */
export interface ScoreConfig {
  calculator: string;
  config: unknown;
}

export interface ExerciseConfigData {
  tests: ExerciseTest[];
  score: ScoreConfig | null;
  environments: EnvironmentConfig[];
  config: ExerciseConfig;
  /** The instance's environments, narrowed to those the simple editor can express. */
  availableEnvironments: { id: string; name: string; longName: string; description: string }[];
  pipelines: ConfigPipelineDefinition[];
  /** True when `viewConfig` was refused -- the tests are still readable, the rest is not. */
  configRefused: boolean;
}

interface RuntimeEnvironmentPayload {
  id: string;
  name: string;
  longName: string;
  description: string;
  extensions: string;
}

interface PipelineListPayload {
  items: ConfigPipelineDefinition[];
}

async function orRefused<T>(read: Promise<T>, fallback: T): Promise<[T, boolean]> {
  try {
    return [await read, false];
  } catch (error) {
    if (error instanceof ApiError && error.httpStatus === 403) return [fallback, true];
    throw error;
  }
}

export async function getExerciseConfigData(exerciseId: string): Promise<ExerciseConfigData> {
  const [tests, scoreRead, configRead, environmentsRead, pipelines, runtimes] = await Promise.all([
    pageRead(
      apiGet<ExerciseTest[]>("/v1/exercises/{id}/tests", { pathParams: { id: exerciseId } }),
    ),
    orRefused(
      apiGet<ScoreConfig>("/v1/exercises/{id}/score-config", { pathParams: { id: exerciseId } }),
      null as ScoreConfig | null,
    ),
    orRefused(
      apiGet<ExerciseConfig>("/v1/exercises/{id}/config", { pathParams: { id: exerciseId } }),
      [] as ExerciseConfig,
    ),
    orRefused(
      apiGet<EnvironmentConfig[]>("/v1/exercises/{id}/environment-configs", {
        pathParams: { id: exerciseId },
      }),
      [] as EnvironmentConfig[],
    ),
    // The pipeline catalogue answers in the paginated envelope the exercise catalog uses, but its
    // `limit` defaults to none: unasked, it returns every pipeline, which is what the editor needs
    // to know where a variable belongs. Listing them at all is `canViewAll`, which a supervisor
    // holds (verified live) -- the exercise's own hints do not gate it.
    apiGet<PipelineListPayload>("/v1/pipelines"),
    apiGet<RuntimeEnvironmentPayload[]>("/v1/runtime-environments"),
  ]);

  const [score] = scoreRead;
  const [config, configRefused] = configRead;
  const [environments] = environmentsRead;

  return {
    tests: [...tests].sort((a, b) => a.name.localeCompare(b.name)),
    score,
    environments,
    config,
    availableEnvironments: runtimes
      .filter((environment) => SIMPLE_FORM_ENVIRONMENTS.includes(environment.id))
      .map((environment) => ({
        id: environment.id,
        name: environment.name,
        longName: environment.longName,
        description: environment.description,
      }))
      .sort((a, b) => a.longName.localeCompare(b.longName)),
    pipelines: pipelines.items ?? [],
    configRefused,
  };
}

export { getRuntimeEnvironments };
