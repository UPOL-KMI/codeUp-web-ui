"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiGet, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

/**
 * Who owns an exercise, who else may change it, and copying it into another group (T-023).
 *
 * **Administrators and the author are two different permissions.** `updateAdmins` lets somebody
 * add colleagues who may edit the exercise; `changeAuthor` hands it over entirely, and core-api
 * grants it far more narrowly -- a group admin holds the first and not always the second, which is
 * why they are separate controls rather than one list with a crown on a row.
 *
 * **Forking is a copy, not a link.** core-api's `Exercise::forkFrom` builds a whole new exercise
 * -- texts, configuration, limits, files -- in the group it is given, and the two have no
 * relationship afterwards beyond a `forkedFrom` id the detail screen names. It is the way to base
 * one exercise on another without either owner being able to break the other's.
 *
 * The people are found by searching core-api's own user list, which it restricts itself: a reader
 * who may not list users gets no candidates rather than a broken control (the shape `/api/search`
 * already uses for the command palette).
 */
export interface PersonHit {
  id: string;
  name: string;
}

async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("ExerciseEdit.people.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

export async function searchPeople(query: string): Promise<ActionResult<PersonHit[]>> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { success: true, data: [] };

  try {
    const result = await apiGet<{ items?: { id: string; fullName: string }[] }>("/v1/users", {
      query: { "filters[search]": trimmed, limit: 10, offset: 0 },
    });
    return {
      success: true,
      data: (result.items ?? []).map((user) => ({ id: user.id, name: user.fullName })),
    };
  } catch (error) {
    if (error instanceof ApiError && error.httpStatus === 403) return { success: true, data: [] };
    return failure(error, "searchFailed");
  }
}

export async function setExerciseAdmins(
  exerciseId: string,
  adminIds: string[],
): Promise<ActionResult<{ count: number }>> {
  try {
    await apiPost(
      "/v1/exercises/{id}/admins",
      { admins: adminIds },
      { pathParams: { id: exerciseId } },
    );
    return { success: true, data: { count: adminIds.length } };
  } catch (error) {
    return failure(error, "adminsFailed");
  }
}

export async function setExerciseAuthor(
  exerciseId: string,
  authorId: string,
): Promise<ActionResult<{ id: string }>> {
  const t = await getTranslations("ExerciseEdit.people.errors");
  if (!authorId) return { success: false, formError: t("noPersonChosen") };

  try {
    await apiPost(
      "/v1/exercises/{id}/author",
      { author: authorId },
      { pathParams: { id: exerciseId } },
    );
    return { success: true, data: { id: authorId } };
  } catch (error) {
    return failure(error, "authorFailed");
  }
}

export async function forkExercise(
  exerciseId: string,
  groupId: string,
): Promise<ActionResult<{ id: string }>> {
  const t = await getTranslations("ExerciseEdit.people.errors");
  if (!groupId) return { success: false, formError: t("noGroupChosen") };

  try {
    const forked = await apiPost<{ id: string }>(
      "/v1/exercises/{id}/fork",
      { groupId },
      { pathParams: { id: exerciseId } },
    );
    return { success: true, data: { id: forked.id } };
  } catch (error) {
    return failure(error, "forkFailed");
  }
}
