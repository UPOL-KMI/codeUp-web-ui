/**
 * Awarding more points than an assignment is worth, and the one-click fix for it.
 *
 * core-api accepts an override above the maximum -- it is a teacher's prerogative -- but on a
 * 20-point assignment a typed 30 is almost always "20, and 10 of bonus" put in the wrong field.
 * The form says so and offers this, rather than refusing a number that is sometimes meant.
 *
 * **The total the teacher typed is preserved.** The excess is added to whatever bonus is already
 * in the other field, so 30 beside a bonus of 2 becomes 20 and 12 -- not 20 and 10, which would
 * silently drop the 2. Where the bonus is empty (the ordinary case) the two agree.
 */
export function isOverMax(override: number | null, maxPoints: number): boolean {
  return override !== null && Number.isInteger(override) && override > maxPoints;
}

export function moveExcessToBonus(
  override: number,
  bonus: number,
  maxPoints: number,
): { override: number; bonus: number } {
  return { override: maxPoints, bonus: bonus + (override - maxPoints) };
}
