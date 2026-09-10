import { z } from "zod";

import { DIFFICULTIES } from "@/lib/exercises/difficulty";

/**
 * An exercise's basic settings, shared by the form and the Server Action that re-validates them
 * (T-008). Its own module, apart from the `"use server"` file, per D-004's rule.
 *
 * The rules restated here are core-api's own (`ExercisesPresenter::actionUpdateDetail`): the
 * localized texts may not be empty and each entry needs a locale, a name and a text; the two
 * solution limits are whole numbers or nothing at all ("no limit"). Difficulty is a closed set of
 * three, which the API documents as a string and this app refuses to widen -- the list itself
 * lives in `lib/exercises/difficulty.ts`, so a form can read it without pulling Zod in (PF-004).
 */
export const exerciseTextSchema = z.object({
  locale: z.string().min(2),
  name: z.string().trim(),
  text: z.string(),
  /** The short description, which only whoever may see the exercise ever reads. */
  description: z.string(),
  /** An external address holding the full text, where the exercise keeps it outside ReCodEx. */
  link: z.string(),
});

export const exerciseSettingsSchema = z
  .object({
    version: z.number().int(),
    texts: z.array(exerciseTextSchema).min(1),
    difficulty: z.enum(DIFFICULTIES),
    isPublic: z.boolean(),
    isLocked: z.boolean(),
    mergeJudgeLogs: z.boolean(),
    solutionFilesLimit: z.number().int().min(1).nullable(),
    solutionSizeLimit: z.number().int().min(1).nullable(),
  })
  .superRefine((values, ctx) => {
    // A locale is offered for every language this app speaks; an empty name means "this exercise
    // has no text in that language" and the action drops it, which is how core-api removes one.
    // At least one has to survive, or the exercise becomes unnameable -- and core-api refuses an
    // empty `localizedTexts` outright.
    if (!values.texts.some((text) => text.name.trim() !== "")) {
      ctx.addIssue({ code: "custom", path: ["texts"], message: "nameRequired" });
    }
  });

export type ExerciseSettingsValues = z.infer<typeof exerciseSettingsSchema>;
