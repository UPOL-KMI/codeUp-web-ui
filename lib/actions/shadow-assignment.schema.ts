import { z } from "zod";

/**
 * A shadow assignment's own settings (G-009), as the form collects them and the Server Action
 * re-validates them.
 *
 * The rules restated here are core-api's, so a mistake is answered in the form rather than by a
 * 400 (`ShadowAssignmentsPresenter::actionUpdateDetail`): the localized texts may not be empty,
 * a `link` must be a real URL where it is given at all, and `maxPoints` is a whole number. The
 * deadline is **informative** -- nothing is enforced against it, which is the whole difference
 * between a shadow assignment and a real one -- so it is nullable and carries no ordering rule.
 *
 * Every locale is submitted, including blank ones. core-api **replaces** the whole collection with
 * what it is sent, so an omitted locale is a deleted locale; the action drops the ones with no name
 * only after checking that at least one survives, which is core-api's own "no entry for localized
 * texts given" rule reached before it has to answer it.
 */
export const shadowTextSchema = z.object({
  locale: z.string().min(2),
  name: z.string().trim(),
  text: z.string(),
  link: z
    .string()
    .trim()
    .refine((value) => value === "" || /^https?:\/\/\S+$/i.test(value), { message: "badLink" }),
});

export const shadowAssignmentSchema = z
  .object({
    texts: z.array(shadowTextSchema).min(1),
    maxPoints: z.number().int().min(0),
    isBonus: z.boolean(),
    isPublic: z.boolean(),
    /** Unix seconds, or null for "no deadline" -- which core-api treats as the same thing. */
    deadline: z.number().int().nullable(),
    /** core-api defaults this to true when the field is absent, so it is always sent. */
    sendNotification: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (!values.texts.some((text) => text.name.trim() !== "")) {
      ctx.addIssue({ code: "custom", path: ["texts"], message: "nameRequired" });
    }
  });

export type ShadowAssignmentValues = z.infer<typeof shadowAssignmentSchema>;
