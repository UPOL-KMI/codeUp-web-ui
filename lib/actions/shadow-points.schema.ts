import { z } from "zod";

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
  points: z.number().int(),
  note: z.string().trim().max(1024),
  /** A datetime-local string, or empty for "no date recorded". */
  awardedAt: z.string(),
});

export type ShadowPointsValues = z.infer<typeof shadowPointsSchema>;
