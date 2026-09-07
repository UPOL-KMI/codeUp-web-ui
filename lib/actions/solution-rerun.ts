"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiDelete, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

/**
 * Running a solution again, and removing one (G-002).
 *
 * **This is the only way to re-grade work already submitted.** A teacher who fixes a broken test,
 * a wrong limit or a bad judge has nothing to apply the fix to otherwise: the solutions on record
 * keep the verdict the broken configuration gave them.
 *
 * None of these checks whether the caller may act. `canResubmitSubmissions` on the *assignment*
 * gates both resubmits, and the solution's own `delete` gates the deletion; core-api decides on
 * every call, and a Server Action is a public HTTP endpoint whatever the UI rendered (brief §6).
 *
 * No `revalidatePath` (DEC-021): every read is `no-store`, and callers refresh the router.
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("Solution.rerun.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

/**
 * Run this one solution again.
 *
 * **The response is a submit's response**, because that is what a resubmit is: core-api's
 * `finishSubmission` builds the same payload for both, monitor channel included. So the caller can
 * land on the same live progress display S-016 built for a fresh submission -- the channel id is
 * disclosed once and never again, so it has to be carried out of here or it is lost.
 *
 * `debug` asks the worker to keep every log and output. It is the thing a teacher turns on when the
 * ordinary result does not explain itself, and it is core-api's own flag rather than this app's.
 */
export async function resubmitSolution(
  solutionId: string,
  debug: boolean,
): Promise<ActionResult<{ monitorChannelId: string | null; expectedTasks: number }>> {
  try {
    const payload = await apiPost<{
      webSocketChannel?: { id: string; expectedTasksCount: number };
    }>("/v1/assignment-solutions/{id}/resubmit", { debug }, { pathParams: { id: solutionId } });
    return {
      success: true,
      data: {
        monitorChannelId: payload.webSocketChannel?.id ?? null,
        expectedTasks: payload.webSocketChannel?.expectedTasksCount ?? 0,
      },
    };
  } catch (error) {
    return failure(error, "resubmitFailed");
  }
}

/**
 * Run every solution of an assignment again.
 *
 * **Asynchronous, and the screen has to say so.** core-api starts a background job and answers with
 * the pending and failed job lists rather than with a result -- and it starts nothing at all if a
 * job for this assignment is already pending, answering with that same list. So "nothing happened"
 * and "a job is already running" are the same response, which is why the caller reports how many
 * jobs are pending rather than claiming the work is done.
 */
export async function resubmitAllSolutions(
  assignmentId: string,
): Promise<ActionResult<{ pending: number; failed: number }>> {
  try {
    const payload = await apiPost<{ pending?: unknown[]; failed?: unknown[] }>(
      "/v1/exercise-assignments/{id}/resubmit-all",
      undefined,
      { pathParams: { id: assignmentId } },
    );
    return {
      success: true,
      data: { pending: payload.pending?.length ?? 0, failed: payload.failed?.length ?? 0 },
    };
  } catch (error) {
    return failure(error, "resubmitAllFailed");
  }
}

/**
 * Remove a solution.
 *
 * Everything goes with it and core-api does not ask twice: the review and its comments, every
 * submission's result archive and job config, and the submitted source itself. The confirmation
 * this app shows is the only one there is.
 */
export async function deleteSolution(
  solutionId: string,
): Promise<ActionResult<{ solutionId: string }>> {
  try {
    await apiDelete("/v1/assignment-solutions/{id}", { pathParams: { id: solutionId } });
    return { success: true, data: { solutionId } };
  } catch (error) {
    return failure(error, "deleteFailed");
  }
}
