/**
 * Which pipeline variables the simple configuration editor knows about, and where each one lives
 * (T-009). Ported from the legacy `helpers/exercise/configSimple.js` descriptor table, which is
 * the only place this knowledge is written down -- core-api validates a configuration but does not
 * publish the vocabulary a simple one is built from.
 *
 * Two filters decide where a variable is written on save. `pipelineFilter` matches the pipeline's
 * own `parameters` (a compilation variable goes in the compilation pipeline, an entry point goes
 * only in a pipeline that declares `hasEntryPoint`); `runtimeFilter` limits a variable to the
 * environments that have it at all (`jar-files` is a JVM thing). Reading ignores both and simply
 * looks through every pipeline of the test, which is what the legacy reader does and is what makes
 * a hand-written configuration survive a round trip through this form.
 *
 * `perEnvironment` is the other axis: most values are shared by every environment the exercise
 * supports -- the expected output of a test is the expected output whatever language wrote it --
 * while the ones tied to how a language is built or started are held per environment.
 */
import {
  ENV_ARDUINO,
  ENV_C_GCC,
  ENV_CPP_GCC,
  ENV_DATA_ONLY,
  ENV_GROOVY,
  ENV_HASKELL,
  ENV_JAVA,
  ENV_KOTLIN,
  ENV_MAVEN,
  ENV_SCALA,
  ENV_SYCL,
} from "./environments";

export type VariableKind = "scalar" | "list" | "filePairs";

export interface VariableDescriptor {
  /** The variable's name in the exercise configuration. */
  variable: string;
  /** Its type there, which core-api validates against the pipeline's declaration. */
  type: string;
  /** The companion variable holding the names the files are given inside the sandbox. */
  namesVariable?: string;
  /** The key this variable takes in the form's per-test (or per-environment) object. */
  prop: string;
  kind: VariableKind;
  perEnvironment: boolean;
  fallback: string | string[];
  pipelineFilter: Record<string, boolean>;
  runtimeFilter?: string[];
}

const EXECUTION_ONLY: Record<string, boolean> = { isCompilationPipeline: false };
const COMPILATION_ONLY: Record<string, boolean> = { isCompilationPipeline: true };
const ANY_PIPELINE: Record<string, boolean> = {};

const COMMON: VariableDescriptor[] = [
  {
    variable: "expected-output",
    type: "remote-file",
    prop: "expectedOutput",
    kind: "scalar",
    perEnvironment: false,
    fallback: "",
    pipelineFilter: EXECUTION_ONLY,
  },
  {
    variable: "stdin-file",
    type: "remote-file",
    prop: "stdinFile",
    kind: "scalar",
    perEnvironment: false,
    fallback: "",
    pipelineFilter: EXECUTION_ONLY,
  },
  {
    variable: "input-files",
    namesVariable: "actual-inputs",
    type: "remote-file[]",
    prop: "inputFiles",
    kind: "filePairs",
    perEnvironment: false,
    fallback: [],
    pipelineFilter: EXECUTION_ONLY,
  },
  {
    variable: "extra-files",
    namesVariable: "extra-file-names",
    type: "remote-file[]",
    prop: "extraFiles",
    kind: "filePairs",
    perEnvironment: true,
    fallback: [],
    pipelineFilter: COMPILATION_ONLY,
  },
  {
    variable: "judge-type",
    type: "string",
    prop: "judgeType",
    kind: "scalar",
    perEnvironment: false,
    fallback: "recodex-judge-normal",
    pipelineFilter: EXECUTION_ONLY,
  },
  {
    variable: "custom-judge",
    type: "remote-file",
    prop: "customJudge",
    kind: "scalar",
    perEnvironment: false,
    fallback: "",
    pipelineFilter: EXECUTION_ONLY,
  },
  {
    variable: "judge-args",
    type: "string[]",
    prop: "judgeArgs",
    kind: "list",
    perEnvironment: false,
    fallback: [],
    pipelineFilter: EXECUTION_ONLY,
  },
];

const DEFAULT_DESCRIPTORS: VariableDescriptor[] = [
  ...COMMON,
  {
    variable: "run-args",
    type: "string[]",
    prop: "runArgs",
    kind: "list",
    perEnvironment: false,
    fallback: [],
    pipelineFilter: EXECUTION_ONLY,
  },
  {
    variable: "actual-output",
    type: "file",
    prop: "actualOutput",
    kind: "scalar",
    perEnvironment: false,
    fallback: "",
    pipelineFilter: { isCompilationPipeline: false, producesFiles: true },
  },
  {
    variable: "jar-files",
    type: "remote-file[]",
    prop: "jarFiles",
    kind: "list",
    perEnvironment: true,
    fallback: [],
    pipelineFilter: COMPILATION_ONLY,
    runtimeFilter: [ENV_JAVA, ENV_KOTLIN, ENV_GROOVY, ENV_SCALA],
  },
  {
    variable: "compile-args",
    type: "string[]",
    prop: "compileArgs",
    kind: "list",
    perEnvironment: true,
    fallback: [],
    pipelineFilter: COMPILATION_ONLY,
    runtimeFilter: [ENV_C_GCC, ENV_CPP_GCC, ENV_ARDUINO, ENV_SYCL],
  },
  {
    variable: "exec-targets",
    type: "string[]",
    prop: "execTargets",
    kind: "list",
    perEnvironment: true,
    fallback: ["exec:java"],
    pipelineFilter: EXECUTION_ONLY,
    runtimeFilter: [ENV_MAVEN],
  },
  {
    variable: "entry-point",
    type: "file",
    prop: "entryPoint",
    kind: "scalar",
    perEnvironment: true,
    fallback: "",
    pipelineFilter: { hasEntryPoint: true },
  },
  {
    variable: "success-exit-codes",
    type: "string[]",
    prop: "successExitCodes",
    kind: "list",
    perEnvironment: true,
    fallback: "0",
    pipelineFilter: { hasSuccessExitCodes: true },
  },
];

/**
 * Two environments replace the table rather than extend it. Neither exists on this deployment, so
 * both are ported from the legacy descriptors and are **unverified against a live instance** --
 * they are here because leaving them out would make the editor quietly wrong for an instance that
 * does have them, which is worse than carrying data nobody here can exercise.
 */
const ENVIRONMENT_DESCRIPTORS: Record<string, VariableDescriptor[]> = {
  [ENV_DATA_ONLY]: [
    {
      variable: "input-files",
      namesVariable: "actual-inputs",
      type: "remote-file[]",
      prop: "inputFiles",
      kind: "filePairs",
      perEnvironment: false,
      fallback: [],
      pipelineFilter: ANY_PIPELINE,
    },
    {
      variable: "run-args",
      type: "string[]",
      prop: "runArgs",
      kind: "list",
      perEnvironment: false,
      fallback: [],
      pipelineFilter: ANY_PIPELINE,
    },
    {
      variable: "custom-judge",
      type: "remote-file",
      prop: "customJudge",
      kind: "scalar",
      perEnvironment: false,
      fallback: "",
      pipelineFilter: ANY_PIPELINE,
    },
  ],
  [ENV_HASKELL]: [
    ...COMMON,
    {
      variable: "entry-point",
      type: "string",
      prop: "entryPointString",
      kind: "scalar",
      perEnvironment: false,
      fallback: "",
      pipelineFilter: EXECUTION_ONLY,
    },
  ],
};

/** The descriptor table for an exercise, chosen by the first environment that overrides it. */
export function descriptorsFor(environmentIds: string[]): VariableDescriptor[] {
  for (const id of environmentIds) {
    const descriptors = ENVIRONMENT_DESCRIPTORS[id];
    if (descriptors) return descriptors;
  }
  return DEFAULT_DESCRIPTORS;
}

export function appliesToPipeline(
  descriptor: VariableDescriptor,
  pipeline: { parameters: Record<string, boolean>; runtimeEnvironmentIds: string[] },
): boolean {
  for (const [parameter, expected] of Object.entries(descriptor.pipelineFilter)) {
    if (pipeline.parameters[parameter] === undefined) return false;
    if (Boolean(pipeline.parameters[parameter]) !== expected) return false;
  }
  if (!descriptor.runtimeFilter) return true;
  return descriptor.runtimeFilter.some((id) => pipeline.runtimeEnvironmentIds.includes(id));
}
