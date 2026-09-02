"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiDelete, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

/**
 * What can be done to a reference solution (T-011).
 *
 * **Re-evaluating is the one that matters.** A reference solution is the proof that an exercise's
 * configuration works; the moment that configuration changes -- new tests, different limits, a
 * different judge -- the proof is stale, and running it again is how an author finds out whether
 * they have just broken their own exercise. `resubmit` does one, `resubmit-all` does every
 * reference solution of the exercise, which is the sensible thing after editing the configuration.
 *
 * **Deleting one can make an exercise unassignable**, because core-api refuses to assign an
 * exercise with no reference solution at all -- a refusal that appears in no list payload and that
 * T-001's picker could only discover by trying. The screen confirms with that consequence named.
 *
 * Visibility is set as core-api's own number rather than a name; the screen owns the vocabulary.
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("ReferenceSolutions.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

export async function setReferenceSolutionVisibility(
  solutionId: string,
  visibility: number,
): Promise<ActionResult<{ visibility: number }>> {
  try {
    await apiPost(
      "/v1/reference-solutions/{solutionId}/visibility",
      { visibility },
      { pathParams: { solutionId } },
    );
    return { success: true, data: { visibility } };
  } catch (error) {
    return failure(error, "visibilityFailed");
  }
}

export async function resubmitReferenceSolution(
  solutionId: string,
  debug: boolean,
): Promise<ActionResult<{ id: string }>> {
  try {
    await apiPost(
      "/v1/reference-solutions/{id}/resubmit",
      { debug },
      { pathParams: { id: solutionId } },
    );
    return { success: true, data: { id: solutionId } };
  } catch (error) {
    return failure(error, "resubmitFailed");
  }
}

export async function resubmitAllReferenceSolutions(
  exerciseId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    await apiPost(
      "/v1/reference-solutions/exercise/{exerciseId}/resubmit-all",
      {},
      { pathParams: { exerciseId } },
    );
    return { success: true, data: { id: exerciseId } };
  } catch (error) {
    return failure(error, "resubmitFailed");
  }
}

export async function deleteReferenceSolution(
  solutionId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    await apiDelete("/v1/reference-solutions/{solutionId}", { pathParams: { solutionId } });
    return { success: true, data: { id: solutionId } };
  } catch (error) {
    return failure(error, "deleteFailed");
  }
}

/**
 * Submitting a new one. Two calls, as the student submission path is (S-014): `pre-submit` asks
 * core-api what the uploaded files amount to -- which environments they could be, and which files
 * it would ignore -- and `submit` commits. Asking first is what makes the environment a *reported*
 * fact rather than something the author has to know, and it is core-api's own rule about which
 * extensions belong to which language rather than a copy of it here.
 */
export interface PreSubmitAnswer {
  /** Environment ids the uploaded files could belong to, decided by core-api from their names. */
  environments: string[];
}

export async function preSubmitReferenceSolution(
  exerciseId: string,
  uploadedFileIds: string[],
): Promise<ActionResult<PreSubmitAnswer>> {
  const t = await getTranslations("ReferenceSolutions.errors");
  if (uploadedFileIds.length === 0) return { success: false, formError: t("noFiles") };

  try {
    const answer = await apiPost<{ environments?: string[] }>(
      "/v1/reference-solutions/exercise/{exerciseId}/pre-submit",
      { files: uploadedFileIds },
      { pathParams: { exerciseId } },
    );
    return { success: true, data: { environments: answer.environments ?? [] } };
  } catch (error) {
    return failure(error, "preSubmitFailed");
  }
}

export async function submitReferenceSolution(
  exerciseId: string,
  values: { uploadedFileIds: string[]; environmentId: string; note: string },
): Promise<ActionResult<{ id: string }>> {
  const t = await getTranslations("ReferenceSolutions.errors");
  if (values.uploadedFileIds.length === 0) return { success: false, formError: t("noFiles") };
  if (!values.environmentId) return { success: false, formError: t("noEnvironment") };

  try {
    const created = await apiPost<{ referenceSolution?: { id: string }; id?: string }>(
      "/v1/reference-solutions/exercise/{exerciseId}/submit",
      {
        note: values.note.trim(),
        files: values.uploadedFileIds,
        runtimeEnvironmentId: values.environmentId,
      },
      { pathParams: { exerciseId } },
    );
    return { success: true, data: { id: created.referenceSolution?.id ?? created.id ?? "" } };
  } catch (error) {
    return failure(error, "submitFailed");
  }
}
