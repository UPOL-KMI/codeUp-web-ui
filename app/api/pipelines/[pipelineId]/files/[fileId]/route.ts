import { NextResponse } from "next/server";

import { getPipelineFiles } from "@/lib/api/pipeline-files";
import { streamFromCoreApi } from "@/lib/http/stream-download";

/**
 * One of a pipeline's supplementary files, handed to the browser (G-015).
 *
 * **core-api has no per-pipeline download endpoint**, only the generic
 * `/uploaded-files/{id}/download`, and no archive endpoint at all for pipelines the way exercises
 * have one. So this route addresses the file by the pipeline it belongs to and then asks the
 * generic one -- which is why the pipeline id is not decoration: **the file is confirmed to be on
 * that pipeline before anything is streamed.** Without that check this route would be a generic
 * "download any uploaded file by id" proxy, resting entirely on core-api's ACL and turning this
 * app into an oracle for file ids it was never asked about. core-api still authorises the call
 * itself (brief §6, "every Route Handler does the same"); this narrows what can be asked.
 *
 * A reader who may see the pipeline but not its bytes gets core-api's own 403 forwarded, and the
 * screen does not offer the link in the first place -- see `canDownloadPipelineFile` for why that
 * is a role-and-owner test rather than a permission hint.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pipelineId: string; fileId: string }> },
) {
  const { pipelineId, fileId } = await params;

  const files = await getPipelineFiles(pipelineId);
  const file = files.find((candidate) => candidate.id === fileId);
  if (!file) {
    return NextResponse.json({ error: "No such file on this pipeline." }, { status: 404 });
  }

  return streamFromCoreApi(
    `/uploaded-files/${encodeURIComponent(fileId)}/download`,
    file.name || "pipeline-file",
  );
}
