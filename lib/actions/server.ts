"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

/**
 * The four things the server-management screen can do (AD-006).
 *
 * Every one of them is the superadmin's: there is no `resource: broker` rule in
 * `permissions.neon` at all, so only the blanket superadmin allow reaches freezing and unfreezing,
 * and pinging the async worker is the same. Both refused a supervisor with 403 when asked.
 *
 * Aborting is the exception worth naming: `asyncJob.abort` is granted to any `student` on a job
 * they created, so this action is not superadmin-only in core-api even though the only screen that
 * calls it is. No `revalidatePath` (DEC-021).
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("Server.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

/**
 * **Freezing stops the whole deployment evaluating.** The broker keeps accepting nothing until
 * somebody unfreezes it, submissions queue up behind it, and no student is told why -- which is
 * why the control confirms and says that in as many words rather than asking whether the reader is
 * sure.
 */
export async function freezeBroker(): Promise<ActionResult<{ frozen: true }>> {
  try {
    await apiPost("/v1/broker/freeze");
    return { success: true, data: { frozen: true } };
  } catch (error) {
    return failure(error, "freezeFailed");
  }
}

export async function unfreezeBroker(): Promise<ActionResult<{ frozen: false }>> {
  try {
    await apiPost("/v1/broker/unfreeze");
    return { success: true, data: { frozen: false } };
  } catch (error) {
    return failure(error, "unfreezeFailed");
  }
}

/**
 * An empty job whose only purpose is to come back finished.
 *
 * It is the one way to tell a quiet queue from a dead handler: an idle deployment shows an empty
 * table either way, and a ping that stays unfinished says which of the two it is.
 */
export async function pingAsyncWorker(): Promise<ActionResult<{ id: string }>> {
  try {
    const job = await apiPost<{ id: string }>("/v1/async-jobs/ping");
    return { success: true, data: { id: job.id } };
  } catch (error) {
    return failure(error, "pingFailed");
  }
}

export async function abortAsyncJob(jobId: string): Promise<ActionResult<{ id: string }>> {
  try {
    await apiPost("/v1/async-jobs/{id}/abort", undefined, { pathParams: { id: jobId } });
    return { success: true, data: { id: jobId } };
  } catch (error) {
    return failure(error, "abortFailed");
  }
}
