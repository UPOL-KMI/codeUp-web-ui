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
  | "not-scored"
  /**
   * A teacher set the points in place of what the scoring worked out.
   *
   * **Replaces the three score-derived states and only those.** `correct`, `partial` and
   * `incorrect` all answer "what did the scoring make of it", and an override is precisely the
   * answer to that question being somebody else's -- a solution can read "10/10" beside "Špatně"
   * otherwise, which is the row disagreeing with itself. The states above it are untouched: a
   * compilation failure or a lost job is what *happened to the run*, which no award changes, and
   * the points column shows the award either way.
   *
   * Bonus points are deliberately not this. They add to the automatic result rather than replacing
   * it, and are already rendered as the `+5` beside the figure.
   */
  | "overridden"
  /**
   * A data-only submission that ran cleanly and that nobody has marked yet.
   *
   * **Not a grade, which is the point.** A data-only exercise runs no student code: the pipeline
   * hands the file to a judge, and the judge such an exercise gets by default scores it zero --
   * deliberately, so that the machine awards no points for work it never read (DEC-141). Until a
   * teacher says otherwise there is no result to show, and "0 %" or "Špatně" would be a verdict
   * nobody has passed.
   */
  | "awaiting-review"
  /** A data-only submission a teacher has marked: the points are theirs, and worth showing. */
  | "reviewed";

/**
 * How many of a submission's tests passed, where the app was told.
 *
 * **Not what decides the verdict, and that is worth saying.** The state below is read off the
 * evaluation's `score` -- the number the exercise's own scoring produced -- and the two agree only
 * as long as every test carries weight. A teacher who weights a test at nought, or scores by a
 * custom expression, can have every test pass and the score still be zero; the operator hit exactly
 * that and read "Špatně / no test passed" beside a green test. This is the tally itself, so a
 * screen can show what happened alongside what it was worth.
 */
export interface TestTally {
  passed: number;
  total: number;
}

export interface EvaluationInput {
  lastSubmission: {
    failure?: unknown;
    evaluation?: { initFailed?: boolean; score: number } | null;
  } | null;
  /** Assignment maximum; zero means the assignment carries no points at all. */
  maxPoints: number;
  accepted?: boolean;
  /** The solution was submitted to a data-only exercise -- see `awaiting-review`. */
  dataOnly?: boolean;
  /**
   * The points were set by a person in place of the scoring's -- core-api's `overriddenPoints`.
   * Absent on the summary screens, whose stats row does not carry the field at all.
   */
  pointsOverridden?: boolean;
  /**
   * A person has decided what this solution is worth: they set its points in place of the
   * evaluation's, or gave it bonus points. On a data-only exercise that is the only thing that
   * turns "collected" into a result, because nothing else about such a submission is a judgement.
   *
   * **Accepting a solution is deliberately not one of those things.** "Uznat tento pokus" says
   * *which* attempt counts, not what it is worth, and a teacher who cancels the points they gave
   * must land back on "waiting to be marked" rather than on a verdict they just withdrew --
   * reported by the operator, who cancelled an award and watched the screen keep the old answer.
   */
  graded?: boolean;
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
    evaluation?: {
      initFailed?: boolean;
      score: number;
      testResults?: { score: number }[];
    } | null;
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
  dataOnly = false,
  graded = false,
  pointsOverridden = false,
}: EvaluationInput): EvaluationStatus {
  if (!lastSubmission || lastSubmission.failure) return "failed";
  if (!lastSubmission.evaluation) return "pending";
  if (lastSubmission.evaluation.initFailed) return "compilation-failed";

  // Before the point-counting below, because it is not about points: a collected file waits for a
  // teacher whatever the assignment is worth, and once one has marked it their verdict is the
  // result. The score is not consulted -- on a data-only exercise it is the default judge's nought,
  // and a judge a teacher wrote themselves is theirs to interpret.
  if (dataOnly) return graded ? "reviewed" : "awaiting-review";

  // Legacy greys out a scored solution when the assignment is worth nothing and the solution
  // wasn't explicitly accepted -- otherwise a zero-point assignment reads as a failure.
  if (maxPoints === 0 && !accepted) return "not-scored";

  // Below the three states about the run itself, above the three about the score: an override is
  // an answer to "what is this worth", and that is the only question it settles.
  if (pointsOverridden) return "overridden";

  const { score } = lastSubmission.evaluation;
  if (score >= 1) return "correct";
  if (score <= 0) return "incorrect";
  return "partial";
}

/** Which badge tone each state maps to. Single source, so no surface invents its own colouring. */
export const EVALUATION_TONE: Record<
  EvaluationStatus,
  "success" | "warning" | "danger" | "neutral" | "info"
> = {
  failed: "danger",
  pending: "neutral",
  "compilation-failed": "danger",
  correct: "success",
  partial: "warning",
  incorrect: "danger",
  "not-scored": "neutral",
  overridden: "info",
  "awaiting-review": "warning",
  reviewed: "success",
};

/**
 * The tally of a submission's tests, or null where there is nothing to count.
 *
 * A test counts as passed on a score of 1, which is what `recodex-judge-*` returns for a match and
 * what core-api stores per test. Kept separate from `evaluationInputOf` rather than folded into
 * it: that function exists to keep the submission out of the client payload, and two numbers are
 * two numbers whether or not a screen happens to want them.
 */
export function testTallyOf(
  submission: {
    evaluation?: { testResults?: { score: number }[] } | null;
  } | null,
): TestTally | null {
  const results = submission?.evaluation?.testResults;
  if (!results || results.length === 0) return null;
  return { passed: results.filter((result) => result.score >= 1).length, total: results.length };
}
