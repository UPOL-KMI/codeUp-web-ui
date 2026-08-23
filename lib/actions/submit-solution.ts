"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

import { submitSolutionSchema, type SubmitSolutionValues } from "./submit-solution.schema";

/**
 * Submitting a solution (S-014), and the pre-flight that precedes it.
 *
 * Server Actions rather than Route Handlers, for the two calls that are small JSON: the token
 * stays server-side (brief §5) and the form kit (D-004) is built to call an action directly. The
 * **files** do not come through here -- they are already uploaded, chunk by chunk, through D-005's
 * Route Handler, and what reaches this action is a list of ids core-api has already accepted.
 * That split is AGENTS.md footgun 7 exactly: a Server Action's request body limit is around 1 MB,
 * and ReCodEx solutions are archives.
 *
 * Neither action re-checks whether the reader may submit. core-api's `canReceiveSubmissions()`
 * folds in the deadline, the attempt limit, the group's licence, exam locks and a system-wide
 * submission lock, and it runs on the real submit regardless of what this app believes -- so the
 * only thing a second implementation here could do is disagree with it.
 */
export interface PreSubmitResult {
  /** Runtime environments core-api considers plausible for the uploaded file names. */
  environments: string[];
  countLimitOk: boolean;
  sizeLimitOk: boolean;
}

interface PreSubmitPayload {
  environments: string[];
  countLimitOK: boolean;
  sizeLimitOK: boolean;
}

export async function preSubmitSolution(
  assignmentId: string,
  files: string[],
): Promise<ActionResult<PreSubmitResult>> {
  const t = await getTranslations("Submit.errors");
  try {
    const payload = await apiPost<PreSubmitPayload>(
      "/v1/exercise-assignments/{id}/pre-submit",
      { files },
      { pathParams: { id: assignmentId } },
    );
    return {
      success: true,
      data: {
        environments: payload.environments ?? [],
        countLimitOk: payload.countLimitOK,
        sizeLimitOk: payload.sizeLimitOK,
      },
    };
  } catch (error) {
    return {
      success: false,
      formError: error instanceof ApiError ? error.message : t("preSubmitFailed"),
    };
  }
}

export interface SubmittedSolution {
  solutionId: string;
  /** The monitor channel this job reports progress on (S-016). core-api discloses it **once**, in
   *  this response -- there is no endpoint that returns it later, which is why the submit form
   *  carries it to the solution screen rather than that screen asking for it. */
  monitorChannelId: string | null;
  expectedTasks: number;
}

export async function submitSolution(
  assignmentId: string,
  values: SubmitSolutionValues,
): Promise<ActionResult<SubmittedSolution>> {
  const t = await getTranslations("Submit.errors");

  // Re-validated here rather than trusted from the client: this function is reachable as an HTTP
  // endpoint whatever the form did.
  const parsed = submitSolutionSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.join(".");
      if (field) fieldErrors[field] = issue.message;
    }
    return { success: false, formError: t("invalid"), fieldErrors };
  }

  try {
    const payload = await apiPost<{
      solution: { id: string };
      webSocketChannel?: { id: string; expectedTasksCount: number };
    }>(
      "/v1/exercise-assignments/{id}/submit",
      {
        note: parsed.data.note,
        files: parsed.data.files,
        runtimeEnvironmentId: parsed.data.runtimeEnvironmentId,
      },
      { pathParams: { id: assignmentId } },
    );
    return {
      success: true,
      data: {
        solutionId: payload.solution.id,
        monitorChannelId: payload.webSocketChannel?.id ?? null,
        expectedTasks: payload.webSocketChannel?.expectedTasksCount ?? 0,
      },
    };
  } catch (error) {
    // core-api's own message is the useful one here -- it is what says *why* a submission was
    // refused (past the deadline, out of attempts, group licence expired), and this app cannot
    // reconstruct that from a status code.
    return {
      success: false,
      formError: error instanceof ApiError ? error.message : t("submitFailed"),
    };
  }
}
