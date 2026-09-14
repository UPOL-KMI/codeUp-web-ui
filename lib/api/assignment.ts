import "server-only";

import { cache } from "react";

import { localizedName, type LocalizedText } from "@/lib/i18n-text/localized";
import { replaceLinkKeys } from "@/lib/i18n-text/file-links";
import { requireSession } from "@/lib/auth/require-session";
import { isDataOnly } from "@/lib/status/exercise-validation";
import { evaluationInputOf, type EvaluationInput } from "@/lib/status/evaluation";

import { apiRead } from "./read";
import { linkMapFromPayload } from "./exercise-files";
import { environmentNames } from "./runtime-environments";
import { groupTeacherIds } from "@/lib/groups/teachers";

/**
 * One assignment, as a student's view of it needs it (S-012).
 *
 * **The reader-facing text is `text`, not `description`** -- a distinction that costs nothing to
 * get right here and would be invisible until a student saw an empty page. In core-api's
 * `LocalizedExercise`, `text` is the assignment as written for whoever solves it, while
 * `description` is the author's internal note about the exercise; the assignment view factory
 * strips `description` for anyone without `viewDescription`, which by `permissions.neon` no plain
 * `student` role ever has. Confirmed on a live response as the seeded student: `text` and
 * `studentHint` present, `description` absent.
 */
export interface AssignmentSolutionRow {
  id: string;
  attemptIndex: number;
  createdAt: number;
  gained: number | null;
  bonus: number;
  maxPoints: number;
  accepted: boolean;
  isBest: boolean;
  reviewRequested: boolean;
  reviewClosed: boolean;
  /** The detection batch that reported similarities for this attempt (S-019), for the reader
   *  allowed to know -- core-api omits the field entirely for everyone else. */
  plagiarismBatchId: string | null;
  /** Shaped for `evaluationStatus()` -- real evaluation data, not the stats row's coarse string. */
  evaluation: EvaluationInput;
}

export interface AssignmentDetail {
  id: string;
  name: string;
  text: string;
  studentHint: string;
  externalLink: string;
  groupId: string | null;
  groupName: string;
  exerciseId: string | null;
  createdAt: number;
  visibleFrom: number | null;
  firstDeadline: number;
  secondDeadline: number | null;
  allowSecondDeadline: boolean;
  maxPointsFirst: number;
  maxPointsSecond: number;
  /** Percentage of the test suite that must pass before any points are awarded. */
  pointsThreshold: number;
  submissionsCountLimit: number;
  solutionFilesLimit: number | null;
  solutionSizeLimit: number | null;
  environments: string[];
  /** Every runtime environment is `data-linux`: nothing here is marked by machine. */
  dataOnly: boolean;
  isBonus: boolean;
  isExam: boolean;
  isPublic: boolean;
  can: Record<string, boolean>;
  /** Whether this reader studies in the group -- what decides if the page speaks to them as one. */
  viewerIsStudent: boolean;
  /** Who teaches this group -- marks a teacher's voice in the discussion. */
  groupTeacherIds: string[];
  /** Parts of the assignment that have fallen behind the exercise it was copied from (S-013). */
  staleParts: string[];
  syncPossible: boolean;
  /** core-api's own answer to whether this reader may submit right now, and why not. */
  submission: {
    canSubmit: boolean;
    total: number;
    evaluated: number;
    failed: number;
    lockedReason?: string;
  };
  mySolutions: AssignmentSolutionRow[];
}

interface AssignmentPayload {
  id: string;
  localizedTexts?: (LocalizedText & { text?: string; link?: string; studentHint?: string })[];
  /** `key -> link id` for the assignment's own copy of the exercise's file links. */
  localizedTextsLinks?: Record<string, string>;
  groupId: string | null;
  exerciseId: string | null;
  createdAt: number;
  visibleFrom: number | null;
  firstDeadline: number;
  secondDeadline: number;
  allowSecondDeadline: boolean;
  maxPointsBeforeFirstDeadline: number;
  maxPointsBeforeSecondDeadline: number;
  pointsPercentualThreshold: number;
  submissionsCountLimit: number;
  solutionFilesLimit: number | null;
  solutionSizeLimit: number | null;
  runtimeEnvironmentIds?: string[];
  isBonus: boolean;
  isExam: boolean;
  isPublic: boolean;
  exerciseSynchronizationInfo?: SynchronizationInfo;
  permissionHints?: Record<string, boolean>;
}

/**
 * Every key but `isSynchronizationPossible` and `updatedAt` is one part of the exercise the
 * assignment was copied from, reported as `{upToDate}` -- so the stale ones are read by filtering
 * the object rather than by listing the parts here, which would go out of date the first time
 * core-api grows another one.
 */
export type SynchronizationInfo = Record<string, unknown> & {
  isSynchronizationPossible?: boolean;
};

interface SolutionPayload {
  id: string;
  attemptIndex: number;
  createdAt: number;
  actualPoints: number | null;
  bonusPoints: number;
  maxPoints: number;
  accepted: boolean;
  isBestSolution: boolean;
  reviewRequest: boolean;
  review: { startedAt: number; closedAt: number | null } | null;
  plagiarism?: string | null;
  /** Which language it was submitted in -- the data-only one is not a language but a mode. */
  runtimeEnvironmentId?: string;
  /** Set by a teacher in place of what the pipeline worked out; null when nobody has. */
  overriddenPoints?: number | null;
  lastSubmission: EvaluationInput["lastSubmission"];
}

interface CanSubmitPayload {
  total: number;
  evaluated: number;
  failed: number;
  canSubmit: boolean;
  lockedReason?: string;
}

/** Runtime environment display names, memoized per request -- the ids alone read as `cs-dotnet-core`. */
function localizedText(
  texts: AssignmentPayload["localizedTexts"],
  locale: string,
): { text: string; studentHint: string; link: string } {
  const match = texts?.find((entry) => entry.locale === locale) ?? texts?.[0];
  return {
    text: match?.text ?? "",
    studentHint: match?.studentHint ?? "",
    link: match?.link ?? "",
  };
}

export function stalePartsOf(info: SynchronizationInfo | undefined): string[] {
  if (!info) return [];
  return Object.entries(info)
    .filter(
      ([, value]) =>
        typeof value === "object" &&
        value !== null &&
        (value as { upToDate?: boolean }).upToDate === false,
    )
    .map(([part]) => part);
}

function solutionRow(solution: SolutionPayload): AssignmentSolutionRow {
  return {
    id: solution.id,
    attemptIndex: solution.attemptIndex,
    createdAt: solution.createdAt,
    gained: solution.actualPoints,
    bonus: solution.bonusPoints,
    maxPoints: solution.maxPoints,
    accepted: solution.accepted,
    isBest: solution.isBestSolution,
    reviewRequested: solution.reviewRequest,
    reviewClosed: solution.review?.closedAt != null,
    plagiarismBatchId: solution.plagiarism ?? null,
    evaluation: {
      lastSubmission: evaluationInputOf(solution.lastSubmission),
      maxPoints: solution.maxPoints,
      accepted: solution.accepted,
      // A data-only submission was collected, not marked: see `EvaluationStatus.submitted`.
      dataOnly: isDataOnly([solution.runtimeEnvironmentId ?? ""]),
      // A person decided about it: overrode the points, gave bonus points, or accepted it.
      graded:
        (solution.overriddenPoints !== null && solution.overriddenPoints !== undefined) ||
        solution.bonusPoints !== 0,
    },
  };
}

function newestFirst(rows: AssignmentSolutionRow[]): AssignmentSolutionRow[] {
  return rows.sort((a, b) => b.createdAt - a.createdAt || b.attemptIndex - a.attemptIndex);
}

/**
 * One person's attempts at one assignment, for a reader who is not that person (S-013).
 *
 * The same endpoint the student view reads about themselves -- core-api decides whether this
 * reader may see someone else's solutions, and answers 403 if not.
 */
export const getAssignmentSolutionsOf = cache(async function getAssignmentSolutionsOf(
  assignmentId: string,
  userId: string,
): Promise<AssignmentSolutionRow[]> {
  const solutions = await apiRead<SolutionPayload[]>(
    "/v1/exercise-assignments/{id}/users/{userId}/solutions",
    { pathParams: { id: assignmentId, userId } },
  );
  return newestFirst(solutions.map(solutionRow));
});

export const getAssignmentDetail = cache(async function getAssignmentDetail(
  assignmentId: string,
  locale: string,
): Promise<AssignmentDetail> {
  const session = await requireSession();
  const assignment = await apiRead<AssignmentPayload>("/v1/exercise-assignments/{id}", {
    pathParams: { id: assignmentId },
  });

  const [group, submission, solutions, environments] = await Promise.all([
    assignment.groupId
      ? apiRead<{
          localizedTexts?: LocalizedText[];
          primaryAdminsIds?: string[];
          privateData?: { students?: string[]; admins?: string[]; supervisors?: string[] };
        }>("/v1/groups/{id}", { pathParams: { id: assignment.groupId } })
      : Promise.resolve(null),
    apiRead<CanSubmitPayload>("/v1/exercise-assignments/{id}/can-submit", {
      pathParams: { id: assignmentId },
    }),
    apiRead<SolutionPayload[]>("/v1/exercise-assignments/{id}/users/{userId}/solutions", {
      pathParams: { id: assignmentId, userId: session.userId },
    }),
    environmentNames(),
  ]);

  const texts = localizedText(assignment.localizedTexts, locale);
  // An assignment's text carries `%%key%%` placeholders just as the exercise's does -- the file
  // links are copied along with the text when the assignment is made, and re-filled on every
  // re-sync (G-007). Resolved here for the reason T-023 resolves the exercise's here: a
  // placeholder can stand inside a markdown link target, where no post-parse transform could
  // reach it. The hint is resolved too, which is what the legacy `LocalizedTexts` does.
  const links = linkMapFromPayload(assignment.localizedTextsLinks);

  return {
    id: assignment.id,
    name: localizedName(assignment.localizedTexts, locale),
    text: replaceLinkKeys(texts.text, links),
    studentHint: replaceLinkKeys(texts.studentHint, links),
    externalLink: texts.link,
    groupId: assignment.groupId,
    groupName: group ? localizedName(group.localizedTexts, locale) : "",
    exerciseId: assignment.exerciseId,
    createdAt: assignment.createdAt,
    visibleFrom: assignment.visibleFrom,
    firstDeadline: assignment.firstDeadline,
    secondDeadline:
      assignment.allowSecondDeadline && assignment.secondDeadline > 0
        ? assignment.secondDeadline
        : null,
    allowSecondDeadline: assignment.allowSecondDeadline,
    maxPointsFirst: assignment.maxPointsBeforeFirstDeadline,
    maxPointsSecond: assignment.maxPointsBeforeSecondDeadline,
    pointsThreshold: assignment.pointsPercentualThreshold,
    submissionsCountLimit: assignment.submissionsCountLimit,
    solutionFilesLimit: assignment.solutionFilesLimit,
    solutionSizeLimit: assignment.solutionSizeLimit,
    environments: (assignment.runtimeEnvironmentIds ?? []).map((id) => environments.get(id) ?? id),
    dataOnly: isDataOnly(assignment.runtimeEnvironmentIds ?? []),
    isBonus: assignment.isBonus,
    isExam: assignment.isExam,
    isPublic: assignment.isPublic,
    can: assignment.permissionHints ?? {},
    viewerIsStudent: (group?.privateData?.students ?? []).includes(session.userId),
    groupTeacherIds: groupTeacherIds(group),
    staleParts: stalePartsOf(assignment.exerciseSynchronizationInfo),
    syncPossible: assignment.exerciseSynchronizationInfo?.isSynchronizationPossible === true,
    submission: {
      canSubmit: submission.canSubmit,
      total: submission.total,
      evaluated: submission.evaluated,
      failed: submission.failed,
      ...(submission.lockedReason ? { lockedReason: submission.lockedReason } : {}),
    },
    mySolutions: newestFirst(solutions.map(solutionRow)),
  };
});
