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
  /**
   * Which measure the tests add up by -- or `keep`, meaning the exercise scores by a custom
   * expression and this save must not touch its score configuration. Without that third value,
   * adding a test to an exercise with an expression would have silently replaced the expression
   * with a plain average (the form has to send *something*, and it could only send an average).
   */
  calculator: z.enum(["uniform", "weighted", "keep"]),
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
      // **No minimum.** Removing every test is something core-api accepts (measured: an empty list
      // saves and leaves the exercise with none), and it is how a teacher starts a configuration
      // over. Requiring one here refused that save -- and, because both failures landed on the same
      // error, told them two tests could not share a name when they had sent none at all.
      z.refine(
        (tests: { name: string }[]) =>
          new Set(tests.map((test) => test.name.trim())).size === tests.length,
        { message: "duplicate" },
      ),
    ),
});

/**
 * A weighted configuration whose weights are all zero scores every solution at nought.
 *
 * Found on this deployment: a test that passed (`status OK`, `score 1`) on a solution that scored
 * 0 % and 0 points, because its only weight was `0`. core-api accepts the configuration -- the
 * weighted calculator divides by the sum of the weights and has to answer something for a sum of
 * zero -- so nothing downstream objects, and the teacher sees a green test beside a red verdict
 * with no explanation anywhere.
 *
 * Refused here rather than warned about: there is no exercise for which "no test counts for
 * anything" is the intent, and a configuration that cannot award a point to a perfect solution is
 * not a preference. The form already shows a share of "—" for every row in that state, which was
 * the only signal and evidently not one.
 */
export const testsSchemaChecked = testsSchema.check(
  z.refine(
    (values: TestsValues) =>
      values.calculator !== "weighted" ||
      values.tests.length === 0 ||
      values.tests.reduce((sum, test) => sum + test.weight, 0) > 0,
    { message: "allWeightsZero", path: ["tests"] },
  ),
);

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
