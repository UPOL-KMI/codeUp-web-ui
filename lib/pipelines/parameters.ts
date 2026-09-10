/**
 * The flags a pipeline declares about itself -- what it compiles, what it produces, what an
 * exercise using it must supply (T-013). core-api's own names, in the order the settings form and
 * the catalog list them.
 *
 * **Its own module rather than a constant on `pipeline.schema.ts`, and PF-004 is why.** A schema
 * module pulls Zod's whole runtime in with it, and a `"use client"` component importing one
 * *value* from such a module anchors 52 kB of it in that route's initial chunk group -- however
 * carefully the schema itself is loaded on demand.
 */
export const PIPELINE_PARAMETERS = [
  "isCompilationPipeline",
  "isExecutionPipeline",
  "judgeOnlyPipeline",
  "producesStdout",
  "producesFiles",
  "hasEntryPoint",
  "hasExtraFiles",
  "hasSuccessExitCodes",
] as const;
