import "server-only";

import { cache } from "react";

import type { EvaluationInput } from "@/lib/status/evaluation";

import { apiPost } from "./client";
import { apiRead } from "./read";

/**
 * Every attempt at one assignment, by everyone (T-003).
 *
 * The screen `assignment-solvers.ts` deliberately is not: that one answers "how is the class
 * doing" in one row per student, this one is one row per **submission**, which is what a teacher
 * reads when they want to see a particular attempt rather than a summary. `/v1/exercise-
 * assignments/{id}/solutions` returns them all -- gated by `canViewAssignmentSolutions`, the same
 * hint the class-progress table is gated on -- and `/v1/users/list` puts names on the author ids,
 * the same batched call every roster in this app uses.
 *
 * `status` is shaped for `evaluationStatus()` rather than resolved here, so a row in this table,
 * the badge on the solution screen (S-015) and the dashboard's all answer from one function.
 */
export interface AssignmentSolutionRow {
  id: string;
  attemptIndex: number;
  note: string;
  createdAt: number;
  authorId: string;
  authorName: string;
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
  /** True when core-api reported this solution as arriving after a deadline. */
  pastDeadline: boolean;
  /** A detection batch found similarities for this solution (S-019). Absent for a reader without
   *  `viewDetectedPlagiarisms` -- core-api omits the field rather than nulling it. */
  plagiarismBatchId: string | null;
  status: EvaluationInput;
}

export interface SolutionListPayload {
  id: string;
  attemptIndex: number;
  note?: string | null;
  createdAt: number;
  authorId: string;
  runtimeEnvironmentId: string;
  maxPoints: number;
  actualPoints: number | null;
  bonusPoints: number;
  overriddenPoints: number | null;
  accepted: boolean;
  isBestSolution: boolean;
  reviewRequest: boolean;
  pastDeadline?: number;
  review: { startedAt: number; closedAt: number | null; issues: number } | null;
  lastSubmission: {
    failure?: unknown;
    evaluation?: { initFailed?: boolean; score: number } | null;
  } | null;
  plagiarism?: string | null;
}

/**
 * One payload row as this app's screens read it. Shared with T-005's group-wide list
 * (`group-user-solutions.ts`), which reads the same solution objects from a different endpoint --
 * so the two screens cannot disagree about what a submission's points or review state are.
 */
export function solutionRow(
  solution: SolutionListPayload,
  authorName: string,
): AssignmentSolutionRow {
  return {
    id: solution.id,
    attemptIndex: solution.attemptIndex,
    note: solution.note ?? "",
    createdAt: solution.createdAt,
    authorId: solution.authorId,
    authorName,
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
    // core-api sends a count of seconds past the deadline, `0` for on time -- not a boolean.
    pastDeadline: (solution.pastDeadline ?? 0) > 0,
    plagiarismBatchId: solution.plagiarism ?? null,
    status: {
      lastSubmission: solution.lastSubmission,
      maxPoints: solution.maxPoints,
      accepted: solution.accepted,
    },
  };
}

export const getAssignmentSolutions = cache(async function getAssignmentSolutions(
  assignmentId: string,
): Promise<AssignmentSolutionRow[]> {
  const solutions = await apiRead<SolutionListPayload[]>(
    "/v1/exercise-assignments/{id}/solutions",
    { pathParams: { id: assignmentId } },
  );
  if (solutions.length === 0) return [];

  const authorIds = [...new Set(solutions.map((solution) => solution.authorId))];
  const people = await apiPost<{ id: string; fullName: string }[]>("/v1/users/list", {
    ids: authorIds,
  });
  const names = new Map(people.map((person) => [person.id, person.fullName]));

  return (
    solutions
      .map((solution) => solutionRow(solution, names.get(solution.authorId) ?? ""))
      // Newest first: a teacher opening this screen is almost always looking at what just came in.
      .sort((a, b) => b.createdAt - a.createdAt)
  );
});
