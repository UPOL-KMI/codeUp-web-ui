import "server-only";

import { cache } from "react";

import { localizedName, type LocalizedText } from "@/lib/i18n-text/localized";
import { evaluationInputOf, type EvaluationInput } from "@/lib/status/evaluation";

import { apiRead } from "./read";

/**
 * One submitted solution and how it was evaluated (S-015).
 *
 * A single `GET /v1/assignment-solutions/{id}` carries almost all of it: core-api's solution view
 * embeds the *last submission* in full, evaluation and test results included, so the test-by-test
 * table needs no second request. Only the assignment's name and its group's name are fetched
 * alongside, to say what the solution is a solution *to*.
 *
 * Every field below is what core-api chose to disclose to this reader, not what exists.
 * `TestResult::getDataForView()` nulls the measured values, the ratios and each judge log
 * independently, according to the assignment's `canViewMeasuredValues` / `canViewLimitRatios` /
 * `canViewJudgeStdout` / `canViewJudgeStderr` flags -- so a null here means "not for you", and the
 * UI renders the row without that column rather than inventing a zero.
 */
export interface SolutionTestResult {
  id: number | string;
  testName: string;
  status: string;
  score: number;
  memoryExceeded: boolean;
  wallTimeExceeded: boolean;
  cpuTimeExceeded: boolean;
  exitCode: number | null;
  /** Whether that code is one the *exercise* configured as a success, which need not be zero. */
  exitCodeOk: boolean;
  /** False where the code came from a signal, a timeout or the sandbox rather than the program. */
  exitCodeNative: boolean;
  exitSignal: number | null;
  message: string | null;
  wallTime: number | null;
  cpuTime: number | null;
  memory: number | null;
  wallTimeRatio: number | null;
  cpuTimeRatio: number | null;
  memoryRatio: number | null;
  judgeLogStdout: string | null;
  judgeLogStderr: string | null;
}

export interface SolutionEvaluation {
  evaluatedAt: number;
  score: number;
  points: number;
  /** Compilation (or other initiation) failed, so no test ran. */
  initFailed: boolean;
  initiationOutputs: string | null;
  testResults: SolutionTestResult[];
}

export interface SolutionDetail {
  id: string;
  attemptIndex: number;
  note: string;
  createdAt: number;
  assignmentId: string;
  assignmentName: string;
  groupId: string | null;
  groupName: string;
  /** The group's primary admins -- who may edit anyone's review comment, not just their own
   *  (S-018, reproducing the legacy `restrictCommentAuthor` rule). */
  groupPrimaryAdminIds: string[];
  authorId: string;
  environment: string;
  gained: number | null;
  bonus: number;
  overridden: number | null;
  maxPoints: number;
  accepted: boolean;
  isBest: boolean;
  reviewRequested: boolean;
  reviewStartedAt: number | null;
  reviewClosedAt: number | null;
  reviewIssues: number;
  /** How many submissions this solution has -- more than one means it was resubmitted. */
  submissionCount: number;
  submittedAt: number | null;
  evaluation: SolutionEvaluation | null;
  failure: { type: string; description: string } | null;
  /** Shaped for `evaluationStatus()`, so this screen's badge and every list's agree. */
  status: EvaluationInput;
  /** The detection batch that found similarities *for this solution* (S-019). Null when none did,
   *  and absent entirely for a reader without `viewDetectedPlagiarisms` -- core-api omits the
   *  field rather than nulling it, which is why this is read as "batch or nothing". */
  plagiarismBatchId: string | null;
  can: Record<string, boolean>;
  /** The assignment's `resubmitSubmissions`, which is what gates re-running this solution. */
  canResubmit: boolean;
  /** The assignment's `viewAssignmentSolutions` -- who may read *other people's* attempts, and so
   *  who may compare two of them (G-005). Not the solution's own `viewDetail`, which its author
   *  has for their own work. */
  canViewSolutions: boolean;
}

interface SubmissionPayload {
  submittedAt: number;
  evaluation: SolutionEvaluation | null;
  failure: { type: string; description: string } | null;
}

interface SolutionPayload {
  id: string;
  attemptIndex: number;
  note: string;
  createdAt: number;
  assignmentId: string;
  authorId: string;
  runtimeEnvironmentId: string;
  maxPoints: number;
  actualPoints: number | null;
  bonusPoints: number;
  overriddenPoints: number | null;
  accepted: boolean;
  isBestSolution: boolean;
  reviewRequest: boolean;
  review: { startedAt: number; closedAt: number | null; issues: number } | null;
  submissions: string[];
  lastSubmission: SubmissionPayload | null;
  plagiarism?: string | null;
  permissionHints?: Record<string, boolean>;
}

export const getSolutionDetail = cache(async function getSolutionDetail(
  solutionId: string,
  locale: string,
): Promise<SolutionDetail> {
  const solution = await apiRead<SolutionPayload>("/v1/assignment-solutions/{id}", {
    pathParams: { id: solutionId },
  });

  const assignment = await apiRead<{
    localizedTexts?: LocalizedText[];
    groupId: string | null;
    permissionHints?: Record<string, boolean>;
  }>("/v1/exercise-assignments/{id}", { pathParams: { id: solution.assignmentId } });
  const group = assignment.groupId
    ? await apiRead<{ localizedTexts?: LocalizedText[]; primaryAdminsIds?: string[] }>(
        "/v1/groups/{id}",
        { pathParams: { id: assignment.groupId } },
      )
    : null;

  return {
    id: solution.id,
    attemptIndex: solution.attemptIndex,
    note: solution.note,
    createdAt: solution.createdAt,
    assignmentId: solution.assignmentId,
    assignmentName: localizedName(assignment.localizedTexts, locale),
    groupId: assignment.groupId,
    groupName: group ? localizedName(group.localizedTexts, locale) : "",
    groupPrimaryAdminIds: group?.primaryAdminsIds ?? [],
    authorId: solution.authorId,
    environment: solution.runtimeEnvironmentId,
    gained: solution.actualPoints,
    bonus: solution.bonusPoints,
    overridden: solution.overriddenPoints,
    maxPoints: solution.maxPoints,
    accepted: solution.accepted,
    isBest: solution.isBestSolution,
    reviewRequested: solution.reviewRequest,
    reviewStartedAt: solution.review?.startedAt ?? null,
    reviewClosedAt: solution.review?.closedAt ?? null,
    reviewIssues: solution.review?.issues ?? 0,
    submissionCount: solution.submissions.length,
    submittedAt: solution.lastSubmission?.submittedAt ?? null,
    evaluation: solution.lastSubmission?.evaluation ?? null,
    failure: solution.lastSubmission?.failure ?? null,
    plagiarismBatchId: solution.plagiarism ?? null,
    status: {
      lastSubmission: evaluationInputOf(solution.lastSubmission),
      maxPoints: solution.maxPoints,
      accepted: solution.accepted,
    },
    can: solution.permissionHints ?? {},
    // Re-running is the *assignment's* grant, not the solution's -- core-api checks
    // `canResubmitSubmissions($solution->getAssignment())`. The assignment is already on the wire
    // for its name, so reading its hint here costs nothing.
    canResubmit: assignment.permissionHints?.resubmitSubmissions === true,
    canViewSolutions: assignment.permissionHints?.viewAssignmentSolutions === true,
  };
});

/** One run of a solution through the pipeline (G-004): the same shape the detail's last one has. */
export interface SolutionSubmission {
  id: string;
  submittedAt: number;
  isDebug: boolean;
  evaluation: SolutionEvaluation | null;
  failure: { type: string; description: string } | null;
}

interface SubmissionListPayload {
  id: string;
  submittedAt: number;
  isDebug?: boolean;
  evaluation?: SolutionEvaluation | null;
  failure?: { type: string; description: string } | null;
}

/**
 * Every run behind a solution, newest first (G-004).
 *
 * A solution is re-run whenever a teacher asks for it, and the detail payload carries only the
 * **last** one plus a list of ids. core-api gates this on `canViewDetail` -- the grant that
 * discloses the solution at all -- while the *offer* to look through them is the separate
 * `viewResubmissions` hint the legacy app reads, so the page checks that before asking.
 */
export const getSolutionSubmissions = cache(async function getSolutionSubmissions(
  solutionId: string,
): Promise<SolutionSubmission[]> {
  const payload = await apiRead<SubmissionListPayload[]>(
    "/v1/assignment-solutions/{id}/submissions",
    {
      pathParams: { id: solutionId },
    },
  );
  return payload
    .map((entry) => ({
      id: entry.id,
      submittedAt: entry.submittedAt,
      isDebug: entry.isDebug === true,
      evaluation: entry.evaluation ?? null,
      failure: entry.failure ?? null,
    }))
    .sort((a, b) => b.submittedAt - a.submittedAt);
});

/**
 * How the score of one run was computed (G-004) -- the calculator the exercise used at the moment
 * it ran, which is not necessarily the one it uses now.
 *
 * **Null is the ordinary answer for a run that never produced a result**, not an error: core-api
 * reads the config off the evaluation, and a job that failed has none. Every evaluation on this
 * development host is in exactly that state (DEC-031), so the rendering below it has never been
 * seen with data.
 */
export const getSubmissionScoreConfig = cache(async function getSubmissionScoreConfig(
  submissionId: string,
): Promise<{ calculator: string; config: unknown } | null> {
  return apiRead<{ calculator: string; config: unknown } | null>(
    "/v1/assignment-solutions/submission/{submissionId}/score-config",
    { pathParams: { submissionId } },
  );
});
