/**
 * Splitting a group total back into "points for the work" and "bonus".
 *
 * **core-api folds them together and offers no way to ask for them apart.** A group's
 * `points.gained` is the sum of `AssignmentSolution::getTotalPoints()`, which is
 * `getPoints() + bonusPoints` (`GroupViewFactory::getPointsGainedByStudentForSolutions`) -- so a
 * student with 20 points and a 5-point bonus reads "25/40" there while every other screen in the
 * app says "20/20 +5". Two numbers for one standing, and the reader has to guess which is which.
 *
 * The per-assignment rows *do* carry the bonus on its own, so the split is a subtraction. Shadow
 * assignments have no bonus at all -- `ShadowAssignmentPoints` is a single figure -- so summing the
 * assignment rows is summing every bonus there is.
 *
 * **Where an assignment is hidden from the reader this under-counts the bonus**, because core-api
 * leaves such a row out of `assignments` while still counting it in the total. The visible result
 * is that part of a bonus stays folded into the main figure, which is exactly what happens today
 * for all of it. It cannot report a bonus that is not there.
 */
export interface GroupPointsInput {
  points: { gained: number; total: number };
  assignments: { points: { bonus?: number | null } }[];
}

export function splitGroupPoints(stats: GroupPointsInput): {
  gained: number;
  bonus: number;
  total: number;
} {
  const bonus = stats.assignments.reduce((sum, row) => sum + (row.points.bonus ?? 0), 0);
  return { gained: stats.points.gained - bonus, bonus, total: stats.points.total };
}
