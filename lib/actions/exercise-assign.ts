"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

/**
 * Assigning one exercise to several groups at once (T-012).
 *
 * core-api has no call that does this -- `POST /v1/exercise-assignments` takes one group -- so
 * this issues one per group and **reports each outcome separately**. That is the whole reason it
 * exists rather than the page looping: assigning to five groups where the reader may create in
 * four of them must not be an all-or-nothing failure, and it must not be a success either. What
 * comes back names the groups that worked and the groups that did not, with core-api's own reason
 * for each.
 *
 * The assignments are created **invisible**, as T-001's single-group path leaves them (DEC-093):
 * an assignment nobody has configured yet harms nobody, and each one's settings screen is one
 * click from the list this returns to.
 */
export interface MultiAssignOutcome {
  groupId: string;
  assignmentId?: string;
  error?: string;
}

export async function assignExerciseToGroups(
  exerciseId: string,
  groupIds: string[],
): Promise<ActionResult<MultiAssignOutcome[]>> {
  const t = await getTranslations("ExerciseAssignments.errors");
  if (groupIds.length === 0) return { success: false, formError: t("noGroups") };

  const outcomes = await Promise.all(
    groupIds.map(async (groupId): Promise<MultiAssignOutcome> => {
      try {
        const created = await apiPost<{ id: string }>("/v1/exercise-assignments", {
          exerciseId,
          groupId,
        });
        return { groupId, assignmentId: created.id };
      } catch (error) {
        return {
          groupId,
          error: error instanceof ApiError ? error.message : t("assignFailed"),
        };
      }
    }),
  );

  return { success: true, data: outcomes };
}
