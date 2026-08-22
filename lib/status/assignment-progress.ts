import { EVALUATION_TONE, type EvaluationStatus } from "./evaluation";

/**
 * Where a student stands on one assignment, as the group stats endpoint describes it (S-001).
 *
 * A sibling of `evaluationStatus()` rather than a replacement: that function derives state from a
 * *solution* (which carries `lastSubmission.evaluation`), and this one from the *stats* row
 * core-api precomputes per assignment, which carries only a coarse job state plus the points
 * awarded. Both land on the same display states so a badge cannot say two different things about
 * the same solution in two places -- with one addition, `not-submitted`, which only exists in the
 * stats view because only there is "no solution at all" a value rather than an absence.
 */
export type AssignmentProgress = "not-submitted" | EvaluationStatus;

export interface AssignmentProgressInput {
  /** core-api's `EvaluationStatus::getStatus()` string, or `null` for no valid best solution. */
  status: string | null;
  gained: number | null;
  /** Assignment maximum before the first deadline; zero means it carries no points at all. */
  total: number;
  accepted?: boolean | null;
}

/**
 * Two things this cannot know, both because the stats row does not carry them, and both
 * deliberately resolved towards the state that understates rather than overstates:
 *
 * - **A compilation failure is indistinguishable from a wrong answer here.** `initFailed` lives on
 *   the evaluation, which stats omit; a solution that did not compile scores zero and arrives as
 *   `failed`, so it reads as `incorrect`. The assignment's own screen (S-012/S-015) has the
 *   evaluation and should say `compilation-failed` there.
 * - **A `null` status is reported as `not-submitted` even when submissions exist.** core-api
 *   builds the best solution from *valid* solutions only, so a student whose every attempt hit an
 *   infrastructure failure has no best solution and no status. Saying "not submitted" is wrong for
 *   them, but the alternative -- claiming a failure this row cannot see -- is wrong for the far
 *   more common case of a student who genuinely has not started. Recorded as Q-012.
 */
export function assignmentProgress({
  status,
  gained,
  total,
  accepted = false,
}: AssignmentProgressInput): AssignmentProgress {
  if (!status) return "not-submitted";
  if (status === "work-in-progress") return "pending";
  if (status === "evaluation-failed") return "failed";

  // Same rule as `evaluationStatus()`: a zero-point assignment is not a failed one.
  if (total === 0 && !accepted) return "not-scored";

  if (status === "failed") return "incorrect";
  return (gained ?? 0) >= total ? "correct" : "partial";
}

/**
 * Tones for the states above. Spreads `EVALUATION_TONE` rather than restating it, so the two
 * surfaces can never drift into colouring the same state differently.
 */
export const ASSIGNMENT_PROGRESS_TONE: Record<
  AssignmentProgress,
  (typeof EVALUATION_TONE)[EvaluationStatus]
> = {
  ...EVALUATION_TONE,
  "not-submitted": "neutral",
};
