/**
 * The shapes core-api actually returns for an exercise's configuration (T-009), confirmed live
 * rather than read off the OpenAPI description, which describes every one of these endpoints as a
 * "Placeholder response" with no schema at all (Q-020).
 *
 * The nesting is environment -> test -> pipeline -> variable, and each level is keyed by `name`:
 * an environment's `name` is a runtime environment id (`python3`), a test's is the **numeric id**
 * of the exercise test, and a pipeline's is a pipeline uuid. Nothing here is the id of the config
 * itself; the configuration has no identity of its own and is always replaced whole.
 */
export interface ConfigVariable {
  name: string;
  type: string;
  value: string | string[];
}

export interface ConfigPipeline {
  name: string;
  variables: ConfigVariable[];
}

export interface ConfigTest {
  /** The exercise test's id. core-api sends it as a number; it is compared as a string here. */
  name: string | number;
  pipelines: ConfigPipeline[];
}

export interface ConfigEnvironment {
  name: string;
  tests: ConfigTest[];
}

export type ExerciseConfig = ConfigEnvironment[];

export interface EnvironmentConfig {
  runtimeEnvironmentId: string;
  variablesTable: ConfigVariable[];
}

export interface ExerciseTest {
  id: number;
  name: string;
  description: string;
}

/**
 * A pipeline as the configuration editor needs it. `parameters` is what decides which pipeline a
 * variable belongs in -- `isCompilationPipeline`, `producesStdout`, `hasEntryPoint` and the rest
 * are flags the pipeline author set, and the simple editor never shows them to anybody: it uses
 * them to work out where to write.
 */
export interface ConfigPipelineDefinition {
  id: string;
  name: string;
  runtimeEnvironmentIds: string[];
  parameters: Record<string, boolean>;
}
