import * as z from "zod/mini";

/**
 * What the pipeline editor sends (T-015/T-016). Its own module, not the `"use server"` one, for
 * the reason `use-server-action-form.ts` records: a schema declared beside a Server Action is
 * silently replaced by the compiler pass and comes back as something `zodResolver` rejects.
 */
const portSchema = z.object({ type: z.string(), value: z.string() });

export const structureSchema = z.object({
  version: z.number().check(z.int()),
  boxes: z.array(
    z.object({
      name: z.string().check(z.trim(), z.minLength(1)),
      type: z.string().check(z.minLength(1)),
      portsIn: z.record(z.string(), portSchema),
      portsOut: z.record(z.string(), portSchema),
    }),
  ),
  variables: z.array(
    z.object({
      name: z.string().check(z.trim(), z.minLength(1)),
      type: z.string().check(z.minLength(1)),
      value: z.union([z.string(), z.array(z.string())]),
    }),
  ),
});

export type StructureValues = z.infer<typeof structureSchema>;

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

export const pipelineSettingsSchema = z.object({
  version: z.number().check(z.int()),
  name: z.string().check(z.trim(), z.minLength(2)),
  description: z.string(),
  parameters: z.record(z.string(), z.boolean()),
});

export type PipelineSettingsValues = z.infer<typeof pipelineSettingsSchema>;
