/**
 * Solution evaluation state, ported from the legacy `SolutionStatusIcon` decision tree (D-011).
 *
 * Kept as a pure function rather than logic inside a component for two reasons: it is the sort of
 * branching that wants unit tests (it has six outcomes and three of them are failure modes that
 * are awkward to reproduce on a live instance -- brief's own note that this dev machine cannot
 * produce real pass/fail results, DEC-031), and the same state drives more than one surface
 * (badge, list row, solution detail) which must never disagree about what a solution's state is.
 *
 * The field names and the order of the checks come from the legacy component, not from guesswork:
 * a missing submission or a `failure` is an infrastructure failure, a missing `evaluation` means
 * it is still being evaluated, `initFailed` means compilation failed before any test ran, and only
 * then does the score mean anything.
 */
export type EvaluationStatus =
  /** The submission never reached the evaluation pipeline, or the pipeline itself failed. */
  | "failed"
  /** Submitted and queued or running; no result yet. */
  | "pending"
  /** Compilation failed, so no test was executed. Distinct from scoring zero. */
  | "compilation-failed"
  /** Full score. */
  | "correct"
  /** Some tests passed. */
  | "partial"
  /** No test passed. */
  | "incorrect"
  /** Evaluated, but the assignment awards no points and the solution was not accepted. */
  | "not-scored";

export interface EvaluationInput {
  lastSubmission: {
    failure?: unknown;
    evaluation?: { initFailed?: boolean; score: number } | null;
  } | null;
  /** Assignment maximum; zero means the assignment carries no points at all. */
  maxPoints: number;
  accepted?: boolean;
}

/**
 * Narrows core-api's submission object to the three fields `evaluationStatus` reads.
 *
 * core-api embeds the *whole* last submission -- every test result, the judge's stdout, the
 * compilation log -- and a row carrying it is serialised into the HTML of any page that hands the
 * row to a client component. Three fields are enough to pick a badge, so the rest should not cross.
 * `failure` collapses to a boolean and the two `evaluation` fields are copied: null, undefined and
 * an object all have distinct meanings above ("no submission", "not evaluated", "evaluated"), so
 * each branch is preserved rather than normalised.
 */
export function evaluationInputOf(
  submission: {
    failure?: unknown;
    evaluation?: { initFailed?: boolean; score: number } | null;
  } | null,
): EvaluationInput["lastSubmission"] {
  if (!submission) return null;
  const { failure, evaluation } = submission;
  return {
    failure: failure ? true : undefined,
    evaluation: evaluation
      ? { initFailed: evaluation.initFailed, score: evaluation.score }
      : evaluation,
  };
}

export function evaluationStatus({
  lastSubmission,
  maxPoints,
  accepted = false,
}: EvaluationInput): EvaluationStatus {
  if (!lastSubmission || lastSubmission.failure) return "failed";
  if (!lastSubmission.evaluation) return "pending";
  if (lastSubmission.evaluation.initFailed) return "compilation-failed";

  // Legacy greys out a scored solution when the assignment is worth nothing and the solution
  // wasn't explicitly accepted -- otherwise a zero-point assignment reads as a failure.
  if (maxPoints === 0 && !accepted) return "not-scored";

  const { score } = lastSubmission.evaluation;
  if (score >= 1) return "correct";
  if (score <= 0) return "incorrect";
  return "partial";
}

/** Which badge tone each state maps to. Single source, so no surface invents its own colouring. */
export const EVALUATION_TONE: Record<
  EvaluationStatus,
  "success" | "warning" | "danger" | "neutral"
> = {
  failed: "danger",
  pending: "neutral",
  "compilation-failed": "danger",
  correct: "success",
  partial: "warning",
  incorrect: "danger",
  "not-scored": "neutral",
};
