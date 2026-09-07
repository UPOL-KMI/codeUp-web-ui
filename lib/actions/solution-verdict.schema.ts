import { z } from "zod";

/**
 * A teacher's own verdict on a solution: the points they award instead of the ones the pipeline
 * computed, plus a bonus on top (G-001).
 *
 * Both fields are core-api's, and both are nullable for different reasons. `overriddenPoints` is
 * *absent* rather than zero when there is no override -- the solution then scores whatever it
 * scored -- and core-api reads an empty value as "clear the override" and refuses anything that is
 * neither empty nor a whole number. `bonusPoints` is always a number and may be negative: it is a
 * deduction as often as a reward.
 *
 * The maximum is not restated here. The legacy form caps its "full points" shortcut at the
 * assignment's maximum, which this app reproduces in the control that offers it, but core-api
 * itself accepts an override above the maximum -- and a teacher awarding more than an assignment is
 * nominally worth is a thing they are allowed to mean.
 */
export const solutionPointsSchema = z.object({
  overriddenPoints: z.number().int().nullable(),
  bonusPoints: z.number().int(),
});

export type SolutionPointsValues = z.infer<typeof solutionPointsSchema>;
