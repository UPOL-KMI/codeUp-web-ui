"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

import { assignmentSettingsSchema, type AssignmentSettingsValues } from "./assignment.schema";

/**
 * Editing an assignment (T-002), and re-syncing it with the exercise it was copied from.
 *
 * **`updateDetail` replaces the assignment with what it is sent**, so the payload is complete on
 * every save -- a field omitted is a field reset, not a field left alone. `version` is core-api's
 * optimistic lock: it answers `400-010` when someone else saved in the meantime, and that message
 * is surfaced verbatim rather than retried, because the honest response is to reload and look at
 * what changed.
 *
 * The threshold is the one asymmetric field: core-api stores a fraction and takes a whole percent.
 *
 * core-api decides who may do any of this (`canUpdate`, `canSyncWithExercise`) on every call. No
 * `revalidatePath` (DEC-021).
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("AssignmentEdit.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

function timestamp(value: string): number {
  return Math.floor(Date.parse(value) / 1000);
}

export async function updateAssignment(
  assignmentId: string,
  version: number,
  values: AssignmentSettingsValues,
): Promise<ActionResult<{ assignmentId: string }>> {
  const t = await getTranslations("AssignmentEdit.errors");
  const parsed = assignmentSettingsSchema.safeParse(values);
  if (!parsed.success) return { success: false, formError: t("invalid") };

  const data = parsed.data;
  try {
    await apiPost(
      "/v1/exercise-assignments/{id}",
      {
        version,
        isPublic: data.isPublic,
        isBonus: data.isBonus,
        isExam: data.isExam,
        ...(data.visibleFrom !== "" && { visibleFrom: timestamp(data.visibleFrom) }),
        firstDeadline: timestamp(data.firstDeadline),
        maxPointsBeforeFirstDeadline: data.maxPointsFirst,
        allowSecondDeadline: data.allowSecondDeadline,
        ...(data.allowSecondDeadline && {
          secondDeadline: timestamp(data.secondDeadline),
          maxPointsBeforeSecondDeadline: data.maxPointsSecond,
        }),
        maxPointsDeadlineInterpolation: data.interpolatePoints,
        pointsPercentualThreshold: data.pointsThreshold,
        submissionsCountLimit: data.submissionsCountLimit,
        solutionFilesLimit: data.solutionFilesLimit,
        solutionSizeLimit: data.solutionSizeLimit,
        disabledRuntimeEnvironmentIds: data.disabledEnvironments,
        canViewLimitRatios: data.canViewLimitRatios,
        canViewMeasuredValues: data.canViewMeasuredValues,
        canViewJudgeStdout: data.canViewJudgeStdout,
        canViewJudgeStderr: data.canViewJudgeStderr,
        localizedStudentHints: Object.fromEntries(
          data.hints.map((hint) => [hint.locale, hint.hint]),
        ),
        sendNotification: data.sendNotification,
      },
      { pathParams: { id: assignmentId } },
    );
    return { success: true, data: { assignmentId } };
  } catch (error) {
    return failure(error, "updateFailed");
  }
}

/**
 * Pull the exercise's current state back into this assignment -- the action S-013's notice has
 * only been *reporting* since it shipped.
 *
 * Everything, not a selection: core-api accepts a list of parts, and offering one would ask a
 * teacher which of "score config" and "exercise config" they meant. The notice already names the
 * parts that have drifted; the answer to all of them is the same button.
 */
export async function syncAssignmentWithExercise(
  assignmentId: string,
): Promise<ActionResult<{ assignmentId: string }>> {
  try {
    await apiPost("/v1/exercise-assignments/{id}/sync-exercise", undefined, {
      pathParams: { id: assignmentId },
    });
    return { success: true, data: { assignmentId } };
  } catch (error) {
    return failure(error, "syncFailed");
  }
}
