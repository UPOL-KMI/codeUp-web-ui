"use server";

import { getTranslations } from "next-intl/server";

import { ApiError, apiDelete, apiPost } from "@/lib/api/client";
import type { ActionResult } from "@/lib/forms/action-result";

/**
 * Everything that changes an exercise's files or the links into them (T-023).
 *
 * **Attaching a file is additive, and a name is an identity.** core-api's own upload action keeps
 * whatever is already attached and replaces only a file whose *name* matches -- carrying that
 * file's links over to the new one, so a link never dangles because somebody uploaded a corrected
 * version. Nothing here has to send the whole set, and nothing here should: sending a list that
 * happened to be one request out of date would be the way to delete a colleague's upload.
 *
 * The upload itself does not go through a Server Action (brief §6.7: their body limit is about
 * 1 MB and exercise files are test data). It goes through the chunked Route Handler S-014 already
 * built; what arrives here is the *ids* of files core-api has already stored, which is exactly
 * what `POST /exercises/{id}/files` wants.
 *
 * A **link key** is `[-a-zA-Z0-9_]{1,16}`, core-api's own rule, and is unique within the exercise.
 * `requiredRole` of `null` means the file is public -- which is the point of a link and not an
 * oversight: an exercise text that renders into a handout needs its figures fetchable by somebody
 * who is not signed in.
 */
async function failure(error: unknown, fallbackKey: string): Promise<ActionResult<never>> {
  const t = await getTranslations("ExerciseEdit.files.errors");
  return {
    success: false,
    formError: error instanceof ApiError ? error.message : t(fallbackKey),
  };
}

export async function attachExerciseFiles(
  exerciseId: string,
  uploadedFileIds: string[],
): Promise<ActionResult<{ count: number }>> {
  const t = await getTranslations("ExerciseEdit.files.errors");
  if (uploadedFileIds.length === 0) return { success: false, formError: t("nothingToAttach") };

  try {
    await apiPost(
      "/v1/exercises/{id}/files",
      { files: uploadedFileIds },
      { pathParams: { id: exerciseId } },
    );
    return { success: true, data: { count: uploadedFileIds.length } };
  } catch (error) {
    return failure(error, "attachFailed");
  }
}

export async function deleteExerciseFile(
  exerciseId: string,
  fileId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    await apiDelete("/v1/exercises/{id}/files/{fileId}", {
      pathParams: { id: exerciseId, fileId },
    });
    return { success: true, data: { id: fileId } };
  } catch (error) {
    return failure(error, "deleteFailed");
  }
}

export async function createExerciseFileLink(
  exerciseId: string,
  values: { exerciseFileId: string; key: string; requiredRole: string | null; saveName: string },
): Promise<ActionResult<{ key: string }>> {
  const t = await getTranslations("ExerciseEdit.files.errors");
  const key = values.key.trim();
  if (!/^[-a-zA-Z0-9_]{1,16}$/.test(key)) return { success: false, formError: t("invalidKey") };
  if (!values.exerciseFileId) return { success: false, formError: t("noFileChosen") };

  try {
    await apiPost(
      "/v1/exercises/{id}/file-links",
      {
        exerciseFileId: values.exerciseFileId,
        key,
        requiredRole: values.requiredRole,
        saveName: values.saveName.trim() || null,
      },
      { pathParams: { id: exerciseId } },
    );
    return { success: true, data: { key } };
  } catch (error) {
    return failure(error, "linkFailed");
  }
}

export async function deleteExerciseFileLink(
  exerciseId: string,
  linkId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    await apiDelete("/v1/exercises/{id}/file-links/{linkId}", {
      pathParams: { id: exerciseId, linkId },
    });
    return { success: true, data: { id: linkId } };
  } catch (error) {
    return failure(error, "unlinkFailed");
  }
}
