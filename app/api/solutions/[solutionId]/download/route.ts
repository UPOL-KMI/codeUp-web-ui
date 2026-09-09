import { streamFromCoreApi } from "@/lib/http/stream-download";

/**
 * Downloading a solution's files as the archive core-api built (S-017).
 *
 * The shared streamer owns the mechanics and the reason for them, including the 202-with-JSON
 * case a `response.ok` check used to let through as a mislabelled ZIP (found live during G-004).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ solutionId: string }> },
) {
  const { solutionId } = await params;
  return streamFromCoreApi(
    `/assignment-solutions/${encodeURIComponent(solutionId)}/download-solution`,
    `${solutionId}.zip`,
  );
}
