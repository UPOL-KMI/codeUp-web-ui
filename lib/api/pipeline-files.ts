import "server-only";

import { ApiError, apiGet } from "./client";

/**
 * A pipeline's supplementary files (G-015) -- what a box in the structure editor means when it
 * names a remote file. `runner.py` on the seeded Python pipelines is the example: without it those
 * pipelines evaluate nothing.
 *
 * **core-api calls them "exercise files" even on a pipeline** (`/pipelines/{id}/exercise-files`),
 * because the entity is shared with the exercise-level ones. They are not the same files and are
 * not reachable from an exercise; the naming is core-api's, and the screens here call them what
 * they are.
 */
export interface PipelineFileEntry {
  id: string;
  name: string;
  size: number;
  uploadedAt: number;
  /**
   * Who uploaded it, and **`null` on every seeded file** -- which matters, because it is the only
   * thing that makes a download reachable for anybody but a superadmin. See
   * `canDownloadPipelineFile`.
   */
  uploaderId: string | null;
}

interface PipelineFilePayload {
  id: string;
  name?: string;
  size?: number;
  uploadedAt?: number;
  userId?: string | null;
}

/**
 * Reading the list is granted more widely than downloading from it: a plain supervisor gets this
 * list and is refused the bytes (verified live, 200 against 403). A refusal here is still an empty
 * list rather than a dead page, the shape `getExerciseFiles` uses.
 */
export async function getPipelineFiles(pipelineId: string): Promise<PipelineFileEntry[]> {
  const files = await apiGet<PipelineFilePayload[]>("/v1/pipelines/{id}/exercise-files", {
    pathParams: { id: pipelineId },
  }).catch((error: unknown) => {
    if (error instanceof ApiError && error.httpStatus === 403) return [] as PipelineFilePayload[];
    throw error;
  });

  return files
    .map((file) => ({
      id: file.id,
      name: file.name ?? "",
      size: file.size ?? 0,
      uploadedAt: file.uploadedAt ?? 0,
      uploaderId: file.userId ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
