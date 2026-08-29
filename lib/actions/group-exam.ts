"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiDelete, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

import { examPeriodSchema, type ExamPeriodValues } from "./group-exam.schema";

/**
 * Running an exam in a group (S-008): the period itself, and the locks students take on it.
 *
 * None of these check whether the caller may do any of it -- core-api's `setExamPeriod`,
 * `removeExamPeriod`, `lockStudent` and `unlockStudent` decide that on every call, and a Server
 * Action is a public HTTP endpoint whatever the UI rendered (brief §6). The hints decide what to
 * *offer*.
 *
 * **No `revalidatePath`**, for the reason DEC-021 gives: every read goes through a `no-store`
 * client, so there is no cached entry to invalidate. Callers refresh the router, which re-runs the
 * server render.
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("Group.exams.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

/**
 * Schedules an exam, or updates the one already scheduled -- core-api uses the same endpoint for
 * both, and infers which from whether the group already has a period set. A `null` begin means
 * "leave the beginning alone", which is the only thing core-api accepts once an exam has started.
 */
export async function setExamPeriod(
  groupId: string,
  values: ExamPeriodValues,
): Promise<ActionResult<{ groupId: string }>> {
  const t = await getTranslations("Group.exams.errors");
  const parsed = examPeriodSchema.safeParse(values);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { success: false, formError: t(issue?.message === "tooLong" ? "tooLong" : "invalid") };
  }

  try {
    await apiPost(
      "/v1/groups/{id}/examPeriod",
      {
        ...(parsed.data.begin !== null && { begin: parsed.data.begin }),
        end: parsed.data.end,
        ...(parsed.data.lockType !== null && { type: parsed.data.lockType }),
      },
      { pathParams: { id: groupId } },
    );
    return { success: true, data: { groupId } };
  } catch (error) {
    return failure(error, "setFailed");
  }
}

/** Cancels a scheduled exam. core-api refuses once one has begun -- terminating a running exam is
 *  `setExamPeriod` with an end of now, which is a different thing and says so in the UI. */
export async function removeExamPeriod(
  groupId: string,
): Promise<ActionResult<{ groupId: string }>> {
  try {
    await apiDelete("/v1/groups/{id}/examPeriod", { pathParams: { id: groupId } });
    return { success: true, data: { groupId } };
  } catch (error) {
    return failure(error, "removeFailed");
  }
}

/**
 * Locks a student into the exam. The address core-api records is **the one this request came
 * from** -- and this request is made by the app's server, not by the student's browser (brief §5:
 * the token never leaves the server). See `docs/QUESTIONS.md` Q-017: the recorded address is the
 * app container's, in this deployment as in the legacy one behind its own proxy.
 */
export async function lockStudentForExam(
  groupId: string,
  userId: string,
): Promise<ActionResult<{ userId: string }>> {
  try {
    await apiPost("/v1/groups/{id}/lock/{userId}", undefined, {
      pathParams: { id: groupId, userId },
    });
    return { success: true, data: { userId } };
  } catch (error) {
    return failure(error, "lockFailed");
  }
}

/** Releases a student's lock -- the teacher's answer to someone who locked in on the wrong machine. */
export async function unlockStudentFromExam(
  groupId: string,
  userId: string,
): Promise<ActionResult<{ userId: string }>> {
  try {
    await apiDelete("/v1/groups/{id}/lock/{userId}", {
      pathParams: { id: groupId, userId },
    });
    return { success: true, data: { userId } };
  } catch (error) {
    return failure(error, "unlockFailed");
  }
}
