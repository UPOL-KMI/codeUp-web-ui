import * as z from "zod/mini";

/**
 * Points awarded by hand for a shadow assignment (S-020), shared by the form and the Server Action
 * that re-validates them. Its own module, apart from the `"use server"` file, per D-004's rule.
 *
 * `points` is a whole number and may be negative -- core-api takes a `VInt` with no floor, and a
 * teacher subtracting points for a late presentation is a real use. The **assignment's own
 * `maxPoints` is not enforced here**: core-api does not enforce it either, and a screen that
 * refused what the API accepts would be this app inventing a rule.
 */
export const shadowPointsSchema = z.object({
  points: z.number().check(z.int()),
  note: z.string().check(z.trim(), z.maxLength(1024)),
  /**
   * Unix seconds, or null for "no date recorded". The picker's wall-clock string is resolved in
   * the browser (`lib/format/datetime-local.ts`), never here -- a server in another zone reads the
   * same string as a different instant.
   */
  awardedAt: z.nullable(z.number().check(z.int())),
});

export type ShadowPointsValues = z.infer<typeof shadowPointsSchema>;
