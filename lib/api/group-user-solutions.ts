import "server-only";

import { notFound } from "next/navigation";

import { localizedName, type LocalizedText } from "@/lib/i18n-text/localized";

import {
  solutionRow,
  type AssignmentSolutionRow,
  type SolutionListPayload,
} from "./assignment-solutions";
import { ApiError, apiGet } from "./client";
import { apiRead, pageRead } from "./read";

/**
 * Everything one student has submitted in one group (T-005).
 *
 * The third of the three ways this app cuts the same solutions. T-003's list is one assignment
 * read across the class; S-013's per-user page is one assignment read for one person; this is one
 * *person* read across the whole course -- which is the view a teacher wants when the question is
 * about the student rather than about the work, and the one a student wants when the question is
 * "what have I handed in for this course".
 *
 * `/v1/groups/{id}/students/{userId}/solutions` answers it in one call, and it is core-api that
 * decides who may ask: `canViewAssignments(group)` **and** `canViewStudentStats(group, user)`.
 * The second is a two-subject rule with no permission hint of its own (DEC-090's shape again) --
 * a supervisor, admin or observer may ask about anyone in their group, a student only about
 * themselves. Verified live: a student reading their own row answers 200, the same student
 * reading a classmate's answers 403.
 *
 * The solutions themselves are filtered a second time inside core-api, per solution, by
 * `canViewDetail` -- so this list is already only what the reader may open.
 */
export interface GroupUserSolutionRow extends AssignmentSolutionRow {
  assignment: { id: string; name: string; canViewSolutions: boolean };
  /** core-api's own hint on this solution: whether this reader may open or close its review. */
  canReview: boolean;
}

export interface GroupUserSolutions {
  student: { id: string; fullName: string };
  rows: GroupUserSolutionRow[];
  /** How many of the group's assignments this student has submitted anything to. */
  assignmentsAttempted: number;
  /** Solutions whose review is open and which this reader may close -- the bulk action's input. */
  pendingReviews: string[];
  /** Solutions a detection batch reported similarities for (S-019); zero for a reader without
   *  `viewDetectedPlagiarisms`, who is not told the batch exists at all. */
  similarities: number;
}

interface GroupAssignmentPayload {
  id: string;
  localizedTexts?: LocalizedText[];
  permissionHints?: Record<string, boolean>;
}

type GroupSolutionPayload = SolutionListPayload & {
  assignmentId: string;
  permissionHints?: Record<string, boolean>;
};

/**
 * core-api answers **400**, not 404, when the named person is not a student of the named group
 * (`GroupsPresenter::actionStudentsSolutions`). That is an address naming nothing rather than a
 * request that went wrong, so it is mapped here -- `pageRead` maps the other three statuses and
 * deliberately leaves 400 alone, because for every other endpoint in this app a 400 really is a
 * bug in the request.
 */
async function readSolutions(groupId: string, userId: string): Promise<GroupSolutionPayload[]> {
  try {
    return await apiGet<GroupSolutionPayload[]>("/v1/groups/{id}/students/{userId}/solutions", {
      pathParams: { id: groupId, userId },
    });
  } catch (error) {
    if (error instanceof ApiError && error.httpStatus === 400) notFound();
    throw error;
  }
}

export async function getGroupUserSolutions(
  groupId: string,
  userId: string,
  locale: string,
): Promise<GroupUserSolutions> {
  const [solutions, assignments, student] = await Promise.all([
    pageRead(readSolutions(groupId, userId)),
    apiRead<GroupAssignmentPayload[]>("/v1/groups/{id}/assignments", {
      pathParams: { id: groupId },
    }),
    apiRead<{ id: string; fullName: string }>("/v1/users/{id}", { pathParams: { id: userId } }),
  ]);

  const byAssignment = new Map(
    assignments.map((assignment) => [
      assignment.id,
      {
        id: assignment.id,
        name: localizedName(assignment.localizedTexts, locale),
        canViewSolutions: assignment.permissionHints?.viewAssignmentSolutions === true,
      },
    ]),
  );

  const rows = solutions
    .map((solution) => ({
      ...solutionRow(solution, student.fullName),
      // An assignment absent from the group's list is one this reader may not see at all; its
      // solutions still belong in the list, because core-api already decided they may read them.
      assignment: byAssignment.get(solution.assignmentId) ?? {
        id: solution.assignmentId,
        name: "",
        canViewSolutions: false,
      },
      canReview: solution.permissionHints?.review === true,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);

  return {
    student: { id: student.id, fullName: student.fullName },
    rows,
    assignmentsAttempted: new Set(rows.map((row) => row.assignment.id)).size,
    pendingReviews: rows
      .filter((row) => row.canReview && row.reviewStartedAt !== null && row.reviewClosedAt === null)
      .map((row) => row.id),
    similarities: rows.filter((row) => row.plagiarismBatchId !== null).length,
  };
}
