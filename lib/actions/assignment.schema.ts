import * as z from "zod/mini";

/**
 * An assignment's settings, as the form collects them and the Server Action re-validates them
 * (T-002). Its own module apart from the `"use server"` file, per D-004's rule.
 *
 * The rules restated here are core-api's own (`AssignmentsPresenter::actionUpdateDetail`), so a
 * mistake is answered in the form rather than by a 400: the point maxima and the threshold have
 * ranges, the submission limit starts at 1, and a second deadline must actually come after the
 * first -- that last one core-api enforces too, and it is the mistake a person actually makes.
 *
 * Deadlines cross as **unix seconds**, converted from the picker's wall-clock string in the
 * browser (S-008's reasoning: the picker speaks the reader's own zone, and a server that parses
 * that string reads it in its own -- which moves every deadline by the offset between them).
 */
export const assignmentSettingsSchema = z
  .object({
    isPublic: z.boolean(),
    isBonus: z.boolean(),
    isExam: z.boolean(),
    /** Null means visible as soon as it is public. */
    visibleFrom: z.nullable(z.number().check(z.int())),
    firstDeadline: z.nullable(z.number().check(z.int())),
    maxPointsFirst: z.number().check(z.int(), z.minimum(0)),
    allowSecondDeadline: z.boolean(),
    secondDeadline: z.nullable(z.number().check(z.int())),
    maxPointsSecond: z.number().check(z.int(), z.minimum(0)),
    interpolatePoints: z.boolean(),
    pointsThreshold: z.number().check(z.int(), z.minimum(0), z.maximum(100)),
    submissionsCountLimit: z.number().check(z.int(), z.minimum(1)),
    solutionFilesLimit: z.nullable(z.number().check(z.int(), z.minimum(1))),
    solutionSizeLimit: z.nullable(z.number().check(z.int(), z.minimum(1))),
    disabledEnvironments: z.array(z.string()),
    canViewLimitRatios: z.boolean(),
    canViewMeasuredValues: z.boolean(),
    canViewJudgeStdout: z.boolean(),
    canViewJudgeStderr: z.boolean(),
    hints: z.array(z.object({ locale: z.string().check(z.minLength(2)), hint: z.string() })),
    /** Only meaningful while the assignment is becoming public for the first time. */
    sendNotification: z.boolean(),
  })
  .check(
    z.superRefine((values, ctx) => {
      if (values.firstDeadline === null) {
        ctx.addIssue({ code: "custom", path: ["firstDeadline"], message: "invalidDate" });
      }
      if (!values.allowSecondDeadline) return;

      if (values.secondDeadline === null) {
        ctx.addIssue({ code: "custom", path: ["secondDeadline"], message: "required" });
        return;
      }
      if (values.firstDeadline !== null && values.secondDeadline <= values.firstDeadline) {
        ctx.addIssue({ code: "custom", path: ["secondDeadline"], message: "beforeFirst" });
      }
    }),
  );

export type AssignmentSettingsValues = z.infer<typeof assignmentSettingsSchema>;
