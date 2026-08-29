import "server-only";

import { cache } from "react";

import { localizedName, type LocalizedText } from "@/lib/i18n-text/localized";
import type { EvaluationInput } from "@/lib/status/evaluation";

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
  can: Record<string, boolean>;
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
  permissionHints?: Record<string, boolean>;
}

export const getSolutionDetail = cache(async function getSolutionDetail(
  solutionId: string,
  locale: string,
): Promise<SolutionDetail> {
  const solution = await apiRead<SolutionPayload>("/v1/assignment-solutions/{id}", {
    pathParams: { id: solutionId },
  });

  const assignment = await apiRead<{ localizedTexts?: LocalizedText[]; groupId: string | null }>(
    "/v1/exercise-assignments/{id}",
    { pathParams: { id: solution.assignmentId } },
  );
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
    status: {
      lastSubmission: solution.lastSubmission,
      maxPoints: solution.maxPoints,
      accepted: solution.accepted,
    },
    can: solution.permissionHints ?? {},
  };
});
