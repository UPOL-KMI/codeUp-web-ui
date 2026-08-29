import { z } from "zod";

import { EXAM_LOCK_TYPES } from "@/lib/status/exam";
import { fromDateTimeLocal } from "@/lib/format/datetime-local";
import { hoursMinutesToSeconds } from "@/lib/format/duration";

const nowSeconds = () => Math.floor(Date.now() / 1000);

/**
 * An exam period as the form collects it, shared by the client form and the Server Action that
 * re-validates it (S-008). Its own module, apart from the `"use server"` file, for the reason
 * D-004 recorded: a `"use server"` module may export only async functions.
 *
 * The times are unix **seconds**, resolved in the browser -- "begins immediately" and "lasts two
 * hours" are both relative to the reader's clock, which is the clock the legacy form uses and the
 * one the reader is looking at. The rules below are core-api's own, restated so a mistake is
 * answered in the form rather than by a 400: the end must follow the beginning, and an exam may
 * not run longer than a day (`GroupsPresenter::actionSetExamPeriod` hardcodes 86400 "for safety").
 */
export const EXAM_MAX_SECONDS = 86400;

/** core-api tolerates a minute of clock skew on "in the future"; matching it avoids a needless refusal. */
export const EXAM_NOW_TOLERANCE_SECONDS = 60;

export const examPeriodSchema = z
  .object({
    /** Absent when the exam has already begun -- core-api refuses to move a beginning that has passed. */
    begin: z.number().int().positive().nullable(),
    end: z.number().int().positive(),
    lockType: z.enum(EXAM_LOCK_TYPES).nullable(),
  })
  .refine((values) => values.begin === null || values.begin < values.end, {
    path: ["end"],
    message: "endBeforeBegin",
  })
  .refine((values) => values.begin === null || values.end - values.begin <= EXAM_MAX_SECONDS, {
    path: ["end"],
    message: "tooLong",
  });

export type ExamPeriodValues = z.infer<typeof examPeriodSchema>;

/**
 * The same period as the *form* collects it: a datetime-local string, a checkbox, an `h:mm`
 * length. Kept apart from `examPeriodSchema` above rather than folded into it with `z.coerce`,
 * because the two are genuinely different shapes -- one is what a person types into three widgets
 * in their own time zone, the other is the pair of unix timestamps core-api stores. The form
 * transforms into the second on submit (`examFormToPeriod`), which is where the browser's clock,
 * and only the browser's clock, decides what "in two hours" means.
 *
 * Messages are **keys**, not sentences: `Group.exams.form.errors.*` renders them, so a rule
 * stated once here reads in both locales (AGENTS.md constraint 6).
 */
export const examFormSchema = z
  .object({
    beginImmediately: z.boolean(),
    begin: z.string(),
    endRelative: z.boolean(),
    length: z.string(),
    end: z.string(),
    lockType: z.enum(EXAM_LOCK_TYPES),
  })
  .superRefine((values, ctx) => {
    const begin = values.beginImmediately ? nowSeconds() : fromDateTimeLocal(values.begin);
    if (begin === null) {
      ctx.addIssue({ code: "custom", path: ["begin"], message: "beginInvalid" });
    }

    const length = values.endRelative ? hoursMinutesToSeconds(values.length) : null;
    if (values.endRelative && length === null) {
      ctx.addIssue({ code: "custom", path: ["length"], message: "lengthInvalid" });
    }

    const end = values.endRelative
      ? begin !== null && length !== null
        ? begin + length
        : null
      : fromDateTimeLocal(values.end);
    if (!values.endRelative && end === null) {
      ctx.addIssue({ code: "custom", path: ["end"], message: "endInvalid" });
    }

    if (end !== null && end < nowSeconds() - EXAM_NOW_TOLERANCE_SECONDS) {
      ctx.addIssue({
        code: "custom",
        path: [values.endRelative ? "length" : "end"],
        message: "endInPast",
      });
    }

    if (begin !== null && end !== null) {
      if (begin >= end) {
        ctx.addIssue({ code: "custom", path: ["end"], message: "endBeforeBegin" });
      } else if (end - begin > EXAM_MAX_SECONDS) {
        ctx.addIssue({
          code: "custom",
          path: [values.endRelative ? "length" : "end"],
          message: "tooLong",
        });
      }
    }
  });

export type ExamFormValues = z.infer<typeof examFormSchema>;

/**
 * The form's values as core-api wants them. A running exam keeps its beginning (core-api refuses
 * to move one that has passed) and its lock type (it refuses to change that too), which is why
 * both are nullable on the way out rather than being sent unchanged and rejected.
 */
export function examFormToPeriod(values: ExamFormValues, examRunning: boolean): ExamPeriodValues {
  const begin = values.beginImmediately ? nowSeconds() : fromDateTimeLocal(values.begin);
  const length = hoursMinutesToSeconds(values.length);
  const end = values.endRelative
    ? (begin ?? nowSeconds()) + (length ?? 0)
    : (fromDateTimeLocal(values.end) ?? 0);

  return {
    begin: examRunning ? null : begin,
    end,
    lockType: examRunning ? null : values.lockType,
  };
}
