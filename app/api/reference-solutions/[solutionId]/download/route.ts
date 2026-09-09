import { streamFromCoreApi } from "@/lib/http/stream-download";

/**
 * Downloading a reference solution's files as the archive core-api built (G-013).
 *
 * Gated by core-api on `canViewDetail` (`checkDownloadSolutionArchive`), which is the grant that
 * discloses the solution at all -- so a reader who can open the screen can take the archive, and
 * there is no hint to check that the page has not already been refused for.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ solutionId: string }> },
) {
  const { solutionId } = await params;
  return streamFromCoreApi(
    `/reference-solutions/${encodeURIComponent(solutionId)}/download-solution`,
    `reference-solution-${solutionId}.zip`,
  );
}
