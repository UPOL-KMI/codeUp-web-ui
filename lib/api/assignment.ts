import "server-only";

import { cache } from "react";

import { localizedName, type LocalizedText } from "@/lib/i18n-text/localized";
import { requireSession } from "@/lib/auth/require-session";
import type { EvaluationInput } from "@/lib/status/evaluation";

import { apiGet } from "./client";

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
  isBonus: boolean;
  isExam: boolean;
  isPublic: boolean;
  can: Record<string, boolean>;
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
  groupId: string | null;
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
  permissionHints?: Record<string, boolean>;
}

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
const fetchEnvironments = cache(async function fetchEnvironments(): Promise<Map<string, string>> {
  const environments = await apiGet<{ id: string; name: string }[]>("/v1/runtime-environments");
  return new Map(environments.map((environment) => [environment.id, environment.name]));
});

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

export const getAssignmentDetail = cache(async function getAssignmentDetail(
  assignmentId: string,
  locale: string,
): Promise<AssignmentDetail> {
  const session = await requireSession();
  const assignment = await apiGet<AssignmentPayload>("/v1/exercise-assignments/{id}", {
    pathParams: { id: assignmentId },
  });

  const [group, submission, solutions, environments] = await Promise.all([
    assignment.groupId
      ? apiGet<{ localizedTexts?: LocalizedText[] }>("/v1/groups/{id}", {
          pathParams: { id: assignment.groupId },
        })
      : Promise.resolve(null),
    apiGet<CanSubmitPayload>("/v1/exercise-assignments/{id}/can-submit", {
      pathParams: { id: assignmentId },
    }),
    apiGet<SolutionPayload[]>("/v1/exercise-assignments/{id}/users/{userId}/solutions", {
      pathParams: { id: assignmentId, userId: session.userId },
    }),
    fetchEnvironments(),
  ]);

  const texts = localizedText(assignment.localizedTexts, locale);

  return {
    id: assignment.id,
    name: localizedName(assignment.localizedTexts, locale),
    text: texts.text,
    studentHint: texts.studentHint,
    externalLink: texts.link,
    groupId: assignment.groupId,
    groupName: group ? localizedName(group.localizedTexts, locale) : "",
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
    isBonus: assignment.isBonus,
    isExam: assignment.isExam,
    isPublic: assignment.isPublic,
    can: assignment.permissionHints ?? {},
    submission: {
      canSubmit: submission.canSubmit,
      total: submission.total,
      evaluated: submission.evaluated,
      failed: submission.failed,
      ...(submission.lockedReason ? { lockedReason: submission.lockedReason } : {}),
    },
    mySolutions: solutions
      .map((solution) => ({
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
        evaluation: {
          lastSubmission: solution.lastSubmission,
          maxPoints: solution.maxPoints,
          accepted: solution.accepted,
        },
      }))
      .sort((a, b) => b.createdAt - a.createdAt || b.attemptIndex - a.attemptIndex),
  };
});
