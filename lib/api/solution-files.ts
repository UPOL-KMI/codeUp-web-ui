import "server-only";

import { cache } from "react";

import { apiGet } from "./client";
import { isBinaryFilename } from "@/lib/code/binary-files";

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

/**
 * Why the files cannot be shown inline, or `null` when they can.
 *
 * **Only text files are weighed.** The byte budget exists because this page fetches and highlights
 * every file it shows, and a file it will not render costs none of that -- so a 3 MB PDF beside a
 * 2 kB README used to push the pair over the limit and refuse both. The operator hit exactly that:
 * two files, and a notice blaming their *number*, which was two.
 */
/** The old boolean, for the two screens that only need "can this be shown at all". */
export function canDisplayFiles(files: SolutionFileEntry[]): boolean {
  return fileDisplayLimit(files) === null;
}

export function fileDisplayLimit(files: SolutionFileEntry[]): "count" | "size" | null {
  if (files.length > MAX_DISPLAYED_FILES) return "count";
  const text = files.filter((file) => !isBinaryFilename(file.entry ?? file.name));
  return text.reduce((total, file) => total + file.size, 0) < MAX_DISPLAYED_BYTES ? null : "size";
}

/**
 * core-api builds both listings with the same `SolutionFilesViewFactory`, so a reference
 * solution's files arrive in exactly this shape, archives included -- read from the presenter
 * rather than assumed (G-013).
 */
function expand(payload: SolutionFilePayload[]): SolutionFileEntry[] {
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
}

export const getSolutionFiles = cache(async function getSolutionFiles(
  solutionId: string,
): Promise<SolutionFileEntry[]> {
  return expand(
    await apiRead<SolutionFilePayload[]>("/v1/assignment-solutions/{id}/files", {
      pathParams: { id: solutionId },
    }),
  );
});

/**
 * The files a **reference** solution is made of (G-013). Gated by core-api on the same
 * `canViewDetail` that discloses the solution at all (`checkFiles` in
 * `ReferenceExerciseSolutionsPresenter`), so a reader who has the screen has these.
 */
export const getReferenceSolutionFiles = cache(async function getReferenceSolutionFiles(
  solutionId: string,
): Promise<SolutionFileEntry[]> {
  return expand(
    await apiRead<SolutionFilePayload[]>("/v1/reference-solutions/{id}/files", {
      pathParams: { id: solutionId },
    }),
  );
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
