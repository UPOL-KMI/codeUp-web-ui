import "server-only";

import { ApiError, apiGet } from "./client";
import type { FileLinkMap } from "@/lib/i18n-text/file-links";
import { fileLinkUrl } from "@/lib/i18n-text/file-links";

/**
 * An exercise's own files and the links into them (T-023).
 *
 * These are the **evaluation's** files -- expected outputs, test data, headers, a custom judge --
 * not anything a student submits. T-009's configuration editor points every one of its file fields
 * at this list, which is why nothing there could be configured until this existed.
 *
 * A **file link** is a second thing entirely, and the reason the two live together: a link gives
 * one file a short key and a role that may fetch it, and core-api then serves it at a public
 * address. An author writes `%%key%%` in the exercise text and gets a working URL wherever the
 * text is rendered, without the file having to be public and without the URL having to be pasted.
 */
export interface ExerciseFileEntry {
  id: string;
  name: string;
  size: number;
}

export interface ExerciseFileLink {
  id: string;
  key: string;
  exerciseFileId: string;
  /** The lowest role that may fetch it; `null` means anybody, signed in or not. */
  requiredRole: string | null;
  /** The name it is downloaded under, when it differs from the file's own. */
  saveName: string | null;
  /** The public core-api address it resolves at. */
  url: string;
}

interface FileLinkPayload {
  id: string;
  key: string;
  exerciseFileId?: string;
  exerciseFile?: { id: string } | string;
  requiredRole?: string | null;
  saveName?: string | null;
}

function publicApiBase(): string {
  return process.env.API_BASE_PUBLIC ?? "";
}

function linkFileId(link: FileLinkPayload): string {
  if (link.exerciseFileId) return link.exerciseFileId;
  if (typeof link.exerciseFile === "string") return link.exerciseFile;
  return link.exerciseFile?.id ?? "";
}

/**
 * Both lists, read together. A refusal on either is an empty list rather than a dead page: reading
 * an exercise is something a teacher may do without being allowed to see everything on it, the
 * shape `getExerciseDetail` already uses for the files themselves.
 */
export async function getExerciseFiles(exerciseId: string): Promise<{
  files: ExerciseFileEntry[];
  links: ExerciseFileLink[];
}> {
  const [files, links] = await Promise.all([
    apiGet<ExerciseFileEntry[]>("/v1/exercises/{id}/files", {
      pathParams: { id: exerciseId },
    }).catch(refusalAsEmpty<ExerciseFileEntry>),
    apiGet<FileLinkPayload[]>("/v1/exercises/{id}/file-links", {
      pathParams: { id: exerciseId },
    }).catch(refusalAsEmpty<FileLinkPayload>),
  ]);

  const base = publicApiBase();
  return {
    files: [...files].sort((a, b) => a.name.localeCompare(b.name)),
    links: [...links]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((link) => ({
        id: link.id,
        key: link.key,
        exerciseFileId: linkFileId(link),
        requiredRole: link.requiredRole ?? null,
        saveName: link.saveName ?? null,
        url: fileLinkUrl(base, link.id),
      })),
  };
}

function refusalAsEmpty<T>(error: unknown): T[] {
  if (error instanceof ApiError && error.httpStatus === 403) return [];
  throw error;
}

/** The `key -> url` map an authored text's `%%key%%` placeholders are resolved against. */
export function linkMap(links: { key: string; url: string }[]): FileLinkMap {
  return Object.fromEntries(links.map((link) => [link.key, link.url]));
}

/**
 * The same map built from what core-api attaches to an entity as `localizedTextsLinks`, which is
 * a plain `key -> link id` object (`ExerciseFileLinks::getLinksMapFor*`) rather than the list the
 * links endpoint serves. An **assignment** has its own copy of the exercise's links -- they are
 * copied when it is created and re-filled on every re-sync -- so this is how an assignment's text
 * resolves its placeholders without a second request for a list it is not allowed to read anyway
 * (the links endpoint is the exercise's, and a group supervisor who did not write the exercise is
 * refused it).
 */
export function linkMapFromPayload(entries: Record<string, string> | undefined): FileLinkMap {
  const base = publicApiBase();
  return Object.fromEntries(
    Object.entries(entries ?? {}).map(([key, id]) => [key, fileLinkUrl(base, id)]),
  );
}
