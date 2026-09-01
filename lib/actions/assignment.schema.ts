import { z } from "zod";

/**
 * An assignment's settings, as the form collects them and the Server Action re-validates them
 * (T-002). Its own module apart from the `"use server"` file, per D-004's rule.
 *
 * The rules restated here are core-api's own (`AssignmentsPresenter::actionUpdateDetail`), so a
 * mistake is answered in the form rather than by a 400: the point maxima and the threshold have
 * ranges, the submission limit starts at 1, and a second deadline must actually come after the
 * first -- that last one core-api enforces too, and it is the mistake a person actually makes.
 *
 * Deadlines are `datetime-local` strings, converted in the browser (S-008's reasoning: the picker
 * speaks the reader's own wall clock, and reinterpreting it elsewhere moves the deadline).
 */
export const assignmentSettingsSchema = z
  .object({
    isPublic: z.boolean(),
    isBonus: z.boolean(),
    isExam: z.boolean(),
    /** Empty means visible as soon as it is public. */
    visibleFrom: z.string(),
    firstDeadline: z.string().min(1, "required"),
    maxPointsFirst: z.number().int().min(0),
    allowSecondDeadline: z.boolean(),
    secondDeadline: z.string(),
    maxPointsSecond: z.number().int().min(0),
    interpolatePoints: z.boolean(),
    pointsThreshold: z.number().int().min(0).max(100),
    submissionsCountLimit: z.number().int().min(1),
    solutionFilesLimit: z.number().int().min(1).nullable(),
    solutionSizeLimit: z.number().int().min(1).nullable(),
    disabledEnvironments: z.array(z.string()),
    canViewLimitRatios: z.boolean(),
    canViewMeasuredValues: z.boolean(),
    canViewJudgeStdout: z.boolean(),
    canViewJudgeStderr: z.boolean(),
    hints: z.array(z.object({ locale: z.string().min(2), hint: z.string() })),
    /** Only meaningful while the assignment is becoming public for the first time. */
    sendNotification: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (Number.isNaN(Date.parse(values.firstDeadline))) {
      ctx.addIssue({ code: "custom", path: ["firstDeadline"], message: "invalidDate" });
    }
    if (values.visibleFrom !== "" && Number.isNaN(Date.parse(values.visibleFrom))) {
      ctx.addIssue({ code: "custom", path: ["visibleFrom"], message: "invalidDate" });
    }
    if (!values.allowSecondDeadline) return;

    if (values.secondDeadline === "" || Number.isNaN(Date.parse(values.secondDeadline))) {
      ctx.addIssue({ code: "custom", path: ["secondDeadline"], message: "required" });
      return;
    }
    if (Date.parse(values.secondDeadline) <= Date.parse(values.firstDeadline)) {
      ctx.addIssue({ code: "custom", path: ["secondDeadline"], message: "beforeFirst" });
    }
  });

export type AssignmentSettingsValues = z.infer<typeof assignmentSettingsSchema>;
