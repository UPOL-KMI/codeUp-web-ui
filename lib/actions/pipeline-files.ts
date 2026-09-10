"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiDelete, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

/**
 * Attaching and removing a pipeline's supplementary files (G-015).
 *
 * The same two facts as T-023's exercise files, because it is core-api's same upload action
 * underneath: **attaching is additive, and a name is an identity** -- what is already attached
 * stays, and a file whose name matches is replaced. So uploading a corrected `runner.py` fixes the
 * pipeline rather than leaving two of them, and nothing here has to send the whole set (sending a
 * list one request out of date is how a colleague's upload gets deleted).
 *
 * The bytes do not travel through a Server Action (brief §6.7). They go through S-014's chunked
 * Route Handler, and what arrives here is the ids of files core-api has already stored.
 *
 * Neither of these checks whether the caller may write: core-api asks its own `canUpdate` on the
 * pipeline for both, and that is the boundary. The `update` hint only decides what is offered.
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("PipelineEdit.files.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

export async function attachPipelineFiles(
  pipelineId: string,
  uploadedFileIds: string[],
): Promise<ActionResult<{ count: number }>> {
  const t = await getTranslations("PipelineEdit.files.errors");
  if (uploadedFileIds.length === 0) return { success: false, formError: t("nothingToAttach") };

  try {
    await apiPost(
      "/v1/pipelines/{id}/exercise-files",
      { files: uploadedFileIds },
      { pathParams: { id: pipelineId } },
    );
    return { success: true, data: { count: uploadedFileIds.length } };
  } catch (error) {
    return failure(error, "attachFailed");
  }
}

export async function deletePipelineFile(
  pipelineId: string,
  fileId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    await apiDelete("/v1/pipelines/{id}/exercise-files/{fileId}", {
      pathParams: { id: pipelineId, fileId },
    });
    return { success: true, data: { id: fileId } };
  } catch (error) {
    return failure(error, "removeFailed");
  }
}
