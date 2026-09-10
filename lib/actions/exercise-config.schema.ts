import * as z from "zod/mini";

/**
 * What the configuration screen's three forms send (T-009). Separate from the action file because
 * a `"use server"` module's compiler pass replaces anything that is not an async function export
 * -- a schema declared there survives as something `zodResolver` rejects at runtime, which
 * `use-server-action-form.ts` records finding the hard way.
 *
 * Test names carry core-api's own rule verbatim (`ExercisesConfigPresenter::actionSetTests`):
 * 64 characters, from a restricted set that excludes the separators its configuration format uses.
 * Enforcing it here is a courtesy, not the boundary -- core-api rejects the same names -- but a
 * name typed into a form should fail beside the field rather than as a red banner after a save
 * that also renumbered the tests.
 */
export const TEST_NAME_PATTERN = /^[-a-zA-Z0-9_()[\].! ]+$/;

export const SCORE_CALCULATORS = ["uniform", "weighted", "universal"] as const;
export type ScoreCalculator = (typeof SCORE_CALCULATORS)[number];

export const testsSchema = z.object({
  calculator: z.enum(["uniform", "weighted"]),
  tests: z
    .array(
      z.object({
        /** Absent for a test being added; core-api mints the id. */
        id: z.nullable(z.number()),
        name: z
          .string()
          .check(z.trim(), z.minLength(1), z.maxLength(64), z.regex(TEST_NAME_PATTERN)),
        weight: z.number().check(z.int(), z.minimum(0), z.maximum(10000)),
      }),
    )
    .check(
      z.minLength(1),
      z.refine(
        (tests: { name: string }[]) =>
          new Set(tests.map((test) => test.name.trim())).size === tests.length,
        { message: "duplicate" },
      ),
    ),
});

export type TestsValues = z.infer<typeof testsSchema>;

export const environmentsSchema = z.object({
  environments: z.array(z.string()).check(z.minLength(1)),
});

export type EnvironmentsValues = z.infer<typeof environmentsSchema>;

const fileEntrySchema = z.object({
  file: z.string(),
  name: z.string(),
});

const testEnvironmentSchema = z.object({
  entryPoint: z.string(),
  successExitCodes: z.string(),
  extraFiles: z.array(fileEntrySchema),
  jarFiles: z.array(z.string()),
  compileArgs: z.array(z.string()),
  execTargets: z.array(z.string()),
});

export const configSchema = z.object({
  tests: z.array(
    z.object({
      id: z.string(),
      expectedOutput: z.string(),
      stdinFile: z.string(),
      inputFiles: z.array(fileEntrySchema),
      judgeType: z.string(),
      useCustomJudge: z.boolean(),
      customJudge: z.string(),
      judgeArgs: z.array(z.string()),
      runArgs: z.array(z.string()),
      useOutFile: z.boolean(),
      actualOutput: z.string(),
      entryPointString: z.string(),
      environments: z.record(z.string(), testEnvironmentSchema),
    }),
  ),
});

export type ConfigValues = z.infer<typeof configSchema>;
