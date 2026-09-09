import { NextResponse } from "next/server";

import { readSessionToken } from "@/lib/auth/session-cookie";

/**
 * The result archive of one reference-solution evaluation (G-014) -- what the worker sent back:
 * the job's own logs and outputs, which is where an author looks when a run failed for a reason
 * the test table does not explain.
 *
 * A Route Handler for the reason every other download here is one: the response is not JSON, and
 * streaming `response.body` hands the bytes on without buffering the archive into this server's
 * memory. The token stays in the httpOnly cookie (brief §5).
 *
 * **Gated by core-api on `canViewDetail`, not on `downloadResultArchive`** -- reference solutions
 * have no such hint, and `checkDownloadResultArchive` in `ReferenceExerciseSolutionsPresenter`
 * tests the solution's own visibility instead. The legacy app makes exactly this distinction at
 * `SolutionDetail.js:237`, reading a different hint for the two kinds of solution.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await params;
  const token = await readSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const apiBase = process.env.API_BASE_INTERNAL;
  if (!apiBase) {
    throw new Error("API_BASE_INTERNAL is not set.");
  }

  const response = await fetch(
    `${apiBase}/reference-solutions/submission/${encodeURIComponent(submissionId)}/download-result`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );

  if (!response.ok || !response.body) {
    return NextResponse.json(
      { error: "The result archive could not be downloaded." },
      { status: response.status === 200 ? 502 : response.status },
    );
  }

  const headers = new Headers();
  headers.set("Content-Type", response.headers.get("content-type") ?? "application/zip");
  headers.set(
    "Content-Disposition",
    response.headers.get("content-disposition") ?? `attachment; filename="${submissionId}.zip"`,
  );
  const length = response.headers.get("content-length");
  if (length) headers.set("Content-Length", length);

  return new Response(response.body, { status: 200, headers });
}
