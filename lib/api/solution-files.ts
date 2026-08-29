import "server-only";

import { cache } from "react";

import { apiGet } from "./client";
import { apiRead } from "./read";

/**
 * The files a solution is made of, and their contents (S-017).
 *
 * `GET /v1/assignment-solutions/{id}/files` returns the *uploaded files* -- and where one of them
 * is a ZIP archive, core-api's `SolutionFilesViewFactory` attaches its `zipEntries` rather than
 * its contents. The legacy app expands those entries into first-class rows
 * (`helpers/solutionFiles.js`), so a student who submitted `solution.zip` reads the sources inside
 * it instead of an archive icon; the same expansion happens here, with the same naming
 * (`archive.zip#dir/main.c`) because that name is what a review comment's `file` field stores.
 */
export interface SolutionFileEntry {
  /** The uploaded file's id -- for a ZIP entry, the id of the archive that contains it. */
  fileId: string;
  /** ZIP entry path, or null for a file submitted on its own. */
  entry: string | null;
  /** `main.c`, or `archive.zip#src/main.c` for an entry. Also the review comment's `file` key. */
  name: string;
  size: number;
  /** core-api marks the file the exercise configuration names as the program's entry point. */
  isEntryPoint: boolean;
}

interface ZipEntryPayload {
  name: string;
  size: number;
}

interface SolutionFilePayload {
  id: string;
  name: string;
  size: number;
  isEntryPoint?: boolean;
  zipEntries?: ZipEntryPayload[];
}

/**
 * The legacy viewer's own ceiling (`filesCanBeDisplayed`), reproduced rather than re-invented:
 * at most 32 files totalling under 1 MiB are rendered inline. Past that the page offers the
 * archive instead -- highlighting a hundred files server-side would cost far more than anyone
 * reading the page is asking for.
 */
export const MAX_DISPLAYED_FILES = 32;
export const MAX_DISPLAYED_BYTES = 1024 * 1024;

export function canDisplayFiles(files: SolutionFileEntry[]): boolean {
  if (files.length > MAX_DISPLAYED_FILES) return false;
  return files.reduce((total, file) => total + file.size, 0) < MAX_DISPLAYED_BYTES;
}

export const getSolutionFiles = cache(async function getSolutionFiles(
  solutionId: string,
): Promise<SolutionFileEntry[]> {
  const payload = await apiRead<SolutionFilePayload[]>("/v1/assignment-solutions/{id}/files", {
    pathParams: { id: solutionId },
  });

  const files: SolutionFileEntry[] = [];
  for (const file of payload) {
    if (file.zipEntries) {
      for (const entry of file.zipEntries) {
        // Directory records and empty entries carry no source to read; the legacy expansion drops
        // them the same way, on the same two suffixes plus a zero size.
        if (entry.name.endsWith("/") || entry.name.endsWith("\\") || entry.size === 0) continue;
        files.push({
          fileId: file.id,
          entry: entry.name,
          name: `${file.name}#${entry.name}`,
          size: entry.size,
          isEntryPoint: false,
        });
      }
    } else {
      files.push({
        fileId: file.id,
        entry: null,
        name: file.name,
        size: file.size,
        isEntryPoint: file.isEntryPoint === true,
      });
    }
  }

  return files.sort((a, b) => a.name.localeCompare(b.name, "en"));
});

export interface FileContent {
  content: string;
  /** The file is not valid UTF-8 -- binary, or an encoding this app cannot show faithfully. */
  malformedCharacters: boolean;
  /** core-api truncated the content at its own preview limit; what is shown is not the whole file. */
  tooLarge: boolean;
}

// Raw client, unlike the listing above: the sources page catches a single file's failure and
// renders the rest, which a refusal interrupt would defeat (F-030).
export const getFileContent = cache(async function getFileContent(
  fileId: string,
  entry: string | null,
): Promise<FileContent> {
  return apiGet<FileContent>("/v1/uploaded-files/{id}/content", {
    pathParams: { id: fileId },
    ...(entry ? { query: { entry } } : {}),
  });
});
