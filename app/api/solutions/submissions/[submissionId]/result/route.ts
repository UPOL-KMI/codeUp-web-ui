import { streamFromCoreApi } from "@/lib/http/stream-download";

/**
 * The result archive of one solution evaluation (G-004) -- what the worker sent back for that run.
 *
 * **Gated on `downloadResultArchive`, which is a real hint here**, unlike a reference solution's
 * archive, which core-api gates on plain `canViewDetail` (G-014). The legacy app makes the same
 * distinction. A run that never produced a result is core-api's 202, which the shared streamer
 * turns into an honest refusal rather than a ZIP full of an error sentence.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await params;
  return streamFromCoreApi(
    `/assignment-solutions/submission/${encodeURIComponent(submissionId)}/download-result`,
    `results-${submissionId}.zip`,
  );
}
