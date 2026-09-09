import { streamFromCoreApi } from "@/lib/http/stream-download";

/**
 * The result archive of one reference-solution evaluation (G-014) -- what the worker sent back:
 * the job's own logs and outputs, which is where an author looks when a run failed for a reason
 * the test table does not explain.
 *
 * **Gated by core-api on `canViewDetail`, not on `downloadResultArchive`** -- reference solutions
 * have no such hint, and `checkDownloadResultArchive` tests the solution's own visibility instead.
 * The legacy app makes exactly this distinction, reading a different hint for the two kinds.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await params;
  return streamFromCoreApi(
    `/reference-solutions/submission/${encodeURIComponent(submissionId)}/download-result`,
    `results-${submissionId}.zip`,
  );
}
