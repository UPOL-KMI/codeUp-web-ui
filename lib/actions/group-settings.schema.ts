import * as z from "zod/mini";

/**
 * A group's own settings, as the form collects them and as the Server Action re-validates them
 * (S-009). Its own module, apart from the `"use server"` file, per D-004's rule.
 *
 * The rules restated here are core-api's, so a mistake is answered in the form rather than by a
 * 400 (`GroupsPresenter::setGroupPoints` and `updateLocalizations`): a group passes on a
 * *percentage threshold* or on an *absolute points limit*, never on both; each must be positive,
 * and a threshold is a whole percent in (0, 100]. Every locale needs a name, because core-api
 * looks a group up by name per locale, so a locale left blank is dropped rather than saved empty --
 * at least one has to remain.
 */
export const PASS_MODES = ["none", "threshold", "pointsLimit"] as const;

export type PassMode = (typeof PASS_MODES)[number];

export const groupTextSchema = z.object({
  locale: z.string().check(z.minLength(2)),
  name: z.string().check(z.trim()),
  description: z.string(),
});

export const groupSettingsSchema = z
  .object({
    texts: z.array(groupTextSchema).check(z.minLength(1)),
    externalId: z.string(),
    isPublic: z.boolean(),
    publicStats: z.boolean(),
    detaining: z.boolean(),
    passMode: z.enum(PASS_MODES),
    /**
     * Whole percent, only read when `passMode` is `threshold` -- and **only checked then**. The
     * range used to live on the field itself, which meant the value left behind by the mode the
     * reader had switched *away* from was still validated, and a form with a perfectly good
     * points limit was refused because of a hidden percentage field it no longer used.
     */
    threshold: z.nullable(z.number()),
    /** Absolute points, only read when `passMode` is `pointsLimit`. Same reasoning as above. */
    pointsLimit: z.nullable(z.number()),
  })
  .check(
    z.superRefine((values, ctx) => {
      // A locale is offered for every language this app speaks, but a group need not be named
      // in all of them -- an empty name means "this group has no text in that language", and the
      // action drops it, which is how core-api deletes one. At least one has to survive, or the
      // group would become unnameable.
      if (!values.texts.some((text) => text.name.trim() !== "")) {
        ctx.addIssue({ code: "custom", path: ["texts"], message: "nameRequired" });
      }
      if (values.passMode === "threshold") {
        const value = values.threshold;
        if (value === null || !Number.isInteger(value) || value < 1 || value > 100) {
          ctx.addIssue({ code: "custom", path: ["threshold"], message: "thresholdRequired" });
        }
      }
      if (values.passMode === "pointsLimit") {
        const value = values.pointsLimit;
        if (value === null || !Number.isInteger(value) || value < 1) {
          ctx.addIssue({ code: "custom", path: ["pointsLimit"], message: "pointsLimitRequired" });
        }
      }
    }),
  );

export type GroupSettingsValues = z.infer<typeof groupSettingsSchema>;
