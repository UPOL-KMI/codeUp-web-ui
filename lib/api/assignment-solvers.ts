import "server-only";

import { cache } from "react";

import { assignmentProgress, type AssignmentProgress } from "@/lib/status/assignment-progress";

import { apiPost } from "./client";
import { apiRead } from "./read";
import type { GroupStudentStats } from "./groups";

/**
 * Who has attempted one assignment, and how far they got (S-013).
 *
 * Three responses, none of which is the solutions list itself: `/v1/assignment-solvers` counts
 * attempts per person, `/v1/groups/{id}/students/stats` carries the points core-api awarded for
 * each student's best solution, and `/v1/users/list` puts names on both. Reading
 * `/v1/exercise-assignments/{id}/solutions` instead would answer the same questions and a great
 * deal more -- every attempt by everyone, which is T-003's screen, not this summary.
 *
 * **The roster is the stats response, not the solver list.** A person keeps their solver record
 * after leaving the group, so building rows from solvers alone would report leavers as students
 * and silently omit everyone who has not started -- which is the half of this table a teacher
 * actually reads.
 */
export interface AssignmentSolver {
  userId: string;
  fullName: string;
  /** Attempts core-api counts against the limit; `0` for a student who has not submitted. */
  attempts: number;
  gained: number | null;
  bonus: number | null;
  maxPoints: number;
  bestSolutionId: string | null;
  accepted: boolean;
  reviewRequested: boolean;
  progress: AssignmentProgress;
}

export interface AssignmentSolverSummary {
  students: number;
  submitted: number;
  correct: number;
  reviewRequests: number;
  /** Mean over students with a scored best solution -- `null` when no solution has been scored. */
  averagePoints: number | null;
  maxPoints: number;
}

interface SolverPayload {
  assignmentId: string;
  /** `null` once the author's account is gone -- the solver record outlives them. */
  solverId: string | null;
  lastAttemptIndex: number;
  evaluationsCount: number;
}

export async function getAssignmentSolvers(
  assignmentId: string,
  groupId: string,
): Promise<AssignmentSolver[]> {
  const [solvers, stats] = await Promise.all([
    apiRead<SolverPayload[]>("/v1/assignment-solvers", { query: { assignmentId } }),
    apiRead<GroupStudentStats[]>("/v1/groups/{id}/students/stats", { pathParams: { id: groupId } }),
  ]);

  const attempts = new Map(solvers.map((solver) => [solver.solverId, solver.lastAttemptIndex]));
  // A solver whose author is gone is not a row. Deleting an account leaves its solutions behind
  // with no author, and `/v1/assignment-solvers` keeps reporting the solver record with
  // `solverId: null` -- which reached the table as a person with no name whose link pointed at
  // `/users/null`, sorted to the top by the empty string, and answered with a refusal when a
  // teacher clicked it.
  const userIds = [...new Set([...stats.map((row) => row.userId), ...attempts.keys()])].filter(
    (userId): userId is string => typeof userId === "string" && userId.length > 0,
  );
  if (userIds.length === 0) return [];

  const people = await apiPost<{ id: string; fullName: string }[]>("/v1/users/list", {
    ids: userIds,
  });
  const names = new Map(people.map((person) => [person.id, person.fullName]));

  return userIds
    .map((userId) => {
      const row = stats
        .find((entry) => entry.userId === userId)
        ?.assignments.find((entry) => entry.id === assignmentId);
      const attemptCount = attempts.get(userId) ?? 0;
      return {
        userId,
        fullName: names.get(userId) ?? "",
        attempts: attemptCount,
        gained: row?.points.gained ?? null,
        bonus: row?.points.bonus ?? null,
        maxPoints: row?.points.total ?? 0,
        bestSolutionId: row?.bestSolutionId ?? null,
        accepted: row?.accepted === true,
        reviewRequested: row?.reviewRequest === true,
        // A null status means "no valid best solution", which covers both a student who never
        // started and one whose every attempt died in the pipeline. The attempt count is what
        // tells those apart, and this is the only view that has it -- Q-012 records the dashboard
        // having to guess, and guessing "not submitted" at someone with eleven attempts.
        progress:
          row?.status == null && attemptCount > 0
            ? ("failed" as const)
            : assignmentProgress({
                status: row?.status ?? null,
                gained: row?.points.gained ?? null,
                total: row?.points.total ?? 0,
                accepted: row?.accepted,
              }),
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export function summarizeSolvers(
  solvers: AssignmentSolver[],
  maxPoints: number,
): AssignmentSolverSummary {
  const scored = solvers.filter(
    (solver) => solver.bestSolutionId !== null && solver.gained !== null,
  );
  return {
    students: solvers.length,
    submitted: solvers.filter((solver) => solver.attempts > 0).length,
    correct: solvers.filter((solver) => solver.progress === "correct").length,
    reviewRequests: solvers.filter((solver) => solver.reviewRequested).length,
    averagePoints:
      scored.length === 0
        ? null
        : scored.reduce((sum, solver) => sum + (solver.gained ?? 0), 0) / scored.length,
    maxPoints,
  };
}

export const getAssignmentSolverSummary = cache(async function getAssignmentSolverSummary(
  assignmentId: string,
  groupId: string,
  maxPoints: number,
): Promise<{ solvers: AssignmentSolver[]; summary: AssignmentSolverSummary }> {
  const solvers = await getAssignmentSolvers(assignmentId, groupId);
  return { solvers, summary: summarizeSolvers(solvers, maxPoints) };
});
