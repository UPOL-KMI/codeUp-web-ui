import "server-only";

import { cache } from "react";

import { apiPost } from "./client";
import { apiRead, pageRead } from "./read";

/**
 * What a detection tool found for one solution (S-019).
 *
 * ReCodEx does not detect plagiarism itself: an external tool runs elsewhere and *uploads* what it
 * found through `POST /v1/plagiarism/...`, which is why a batch names the tool that produced it
 * and carries the time its upload finished. Nothing here is core-api's own judgement, and the
 * screen is worded accordingly -- these are similarities somebody's tool reported, not a verdict.
 *
 * Only a teacher ever sees any of it: `viewDetectedPlagiarisms` is granted from `supervisor-student`
 * upwards on an observed group (`permissions.neon`), and core-api omits the solution's `plagiarism`
 * field entirely for anyone else.
 */
export interface PlagiarismBatch {
  id: string;
  detectionTool: string;
  createdAt: number;
  /** When the tool finished uploading. Null while a batch is still being filled in. */
  uploadCompletedAt: number | null;
}

/** One pair of matching passages: a range in the tested file and the range it matches elsewhere. */
export interface SimilarityFragment {
  tested: { offset: number; length: number };
  other: { offset: number; length: number };
}

export interface SimilarFile {
  id: string;
  /** Null when the tool reported a file that is no longer in core-api. */
  solutionId: string | null;
  solutionFileId: string | null;
  fileName: string;
  fileEntry: string;
  attemptIndex: number | null;
  createdAt: number | null;
  environment: string | null;
  assignmentId: string | null;
  groupId: string | null;
  /** core-api's own answer to whether this reader may open the other solution at all. */
  canViewSolution: boolean;
  fragments: SimilarityFragment[];
}

export interface DetectedSimilarity {
  id: string;
  authorId: string | null;
  authorName: string;
  /** The file *of this solution* that was found similar to someone else's. */
  solutionFileId: string;
  fileEntry: string;
  /** 0..1, as the tool reported it. */
  similarity: number;
  files: SimilarFile[];
}

interface FragmentRef {
  o?: number;
  l?: number;
  offset?: number;
  length?: number;
}

interface SimilarFilePayload {
  id: string;
  solution?: {
    id: string;
    attemptIndex: number;
    createdAt: number;
    runtimeEnvironmentId: string;
    canViewDetail?: boolean;
  } | null;
  assignment?: { id: string; canViewDetail?: boolean } | null;
  groupId?: string | null;
  solutionFile?: { id: string; name?: string } | null;
  fileEntry?: string;
  fragments?: FragmentRef[][];
}

interface SimilarityPayload {
  id: string;
  batchId: string;
  authorId?: string | null;
  testedSolutionId: string;
  solutionFileId: string;
  fileEntry?: string;
  similarity: number;
  files?: SimilarFilePayload[];
}

/**
 * core-api stores fragments in a compressed form (`{o, l}`) and accepts a human-readable one
 * (`{offset, length}`), normalising on write but not on read -- a batch uploaded before that
 * compression existed can still come back long-form. Both are read here rather than assuming the
 * shape this deployment happens to hold.
 */
function fragmentRef(ref: FragmentRef | undefined): { offset: number; length: number } {
  return { offset: ref?.o ?? ref?.offset ?? 0, length: ref?.l ?? ref?.length ?? 0 };
}

export const getPlagiarismBatch = cache(async function getPlagiarismBatch(
  batchId: string,
): Promise<PlagiarismBatch> {
  const batch = await apiRead<{
    id: string;
    detectionTool: string;
    createdAt: number;
    uploadCompletedAt: number | null;
  }>("/v1/plagiarism/{id}", { pathParams: { id: batchId } });

  return {
    id: batch.id,
    detectionTool: batch.detectionTool,
    createdAt: batch.createdAt,
    uploadCompletedAt: batch.uploadCompletedAt ?? null,
  };
});

export const getDetectedSimilarities = cache(async function getDetectedSimilarities(
  batchId: string,
  solutionId: string,
): Promise<DetectedSimilarity[]> {
  const similarities = await apiRead<SimilarityPayload[]>("/v1/plagiarism/{id}/{solutionId}", {
    pathParams: { id: batchId, solutionId },
  });
  if (similarities.length === 0) return [];

  const authorIds = [
    ...new Set(similarities.map((record) => record.authorId).filter((id) => id !== null)),
  ];
  const authors =
    authorIds.length > 0
      ? await pageRead(
          apiPost<{ id: string; fullName: string }[]>("/v1/users/list", { ids: authorIds }),
        )
      : [];
  const names = new Map(authors.map((author) => [author.id, author.fullName]));

  return similarities
    .map((record) => ({
      id: record.id,
      authorId: record.authorId ?? null,
      authorName: record.authorId ? (names.get(record.authorId) ?? "") : "",
      solutionFileId: record.solutionFileId,
      fileEntry: record.fileEntry ?? "",
      similarity: record.similarity,
      files: (record.files ?? []).map((file) => ({
        id: file.id,
        solutionId: file.solution?.id ?? null,
        solutionFileId: file.solutionFile?.id ?? null,
        fileName: file.solutionFile?.name ?? "",
        fileEntry: file.fileEntry ?? "",
        attemptIndex: file.solution?.attemptIndex ?? null,
        createdAt: file.solution?.createdAt ?? null,
        environment: file.solution?.runtimeEnvironmentId ?? null,
        assignmentId: file.assignment?.id ?? null,
        groupId: file.groupId ?? null,
        canViewSolution: file.solution?.canViewDetail === true,
        fragments: (file.fragments ?? []).map((pair) => ({
          tested: fragmentRef(pair[0]),
          other: fragmentRef(pair[1]),
        })),
      })),
    }))
    .sort((a, b) => b.similarity - a.similarity);
});
