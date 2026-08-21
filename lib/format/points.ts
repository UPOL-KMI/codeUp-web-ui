/**
 * Points and percentage formatting (D-012). Brief §9: "One date format, one relative-time format,
 * one points/percentage format -- shared helpers." Points appear on nearly every ReCodEx screen,
 * and the failure mode of not sharing this is subtle: two screens rounding a score differently
 * makes the same solution look like two different results.
 */

/**
 * `7/10`, or just `7` where there is no maximum to compare against. Bonus points are rendered
 * separately by the caller rather than folded in here -- the legacy UI shows them as a distinct
 * annotation, and silently adding them to the total would misrepresent what was awarded for the
 * solution itself.
 */
export function formatPoints(actual: number, max?: number | null): string {
  return max === null || max === undefined ? String(actual) : `${actual}/${max}`;
}

/**
 * A ratio in [0, 1] as a whole-number percentage.
 *
 * Rounds **down**, deliberately. Rounding to nearest would let a solution that passed 99.6% of a
 * test suite display as "100%", which in a grading tool reads as "everything passed" and is the
 * one number a student is most likely to challenge. Values outside [0, 1] are clamped rather than
 * trusted: `score` comes from the evaluation pipeline, and a malformed one should not render as
 * "-300%".
 */
export function formatPercent(score: number): string {
  const clamped = Math.min(1, Math.max(0, score));
  return `${Math.floor(clamped * 100)}%`;
}
