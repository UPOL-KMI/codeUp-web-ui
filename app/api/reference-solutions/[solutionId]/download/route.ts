import { NextResponse } from "next/server";

import { readSessionToken } from "@/lib/auth/session-cookie";

/**
 * Downloading a reference solution's files as the archive core-api built (G-013).
 *
 * The same shape as `app/api/solutions/[solutionId]/download/route.ts` and for the same reasons:
 * the response is not JSON, so `lib/api/client.ts` would reject it while unwrapping core-api's
 * envelope, and streaming `response.body` hands the bytes on without buffering an archive into
 * this server's memory. The token is read from the httpOnly cookie here and never reaches the
 * browser (brief §5) -- the link the page renders points at this app.
 *
 * core-api gates it on `canViewDetail` (`checkDownloadSolutionArchive`), which is the grant that
 * discloses the solution at all, so a reader who can open the screen can take the archive: no
 * hint to check that the page has not already been refused for.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ solutionId: string }> },
) {
  const { solutionId } = await params;
  const token = await readSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const apiBase = process.env.API_BASE_INTERNAL;
  if (!apiBase) {
    throw new Error("API_BASE_INTERNAL is not set.");
  }

  const response = await fetch(
    `${apiBase}/reference-solutions/${encodeURIComponent(solutionId)}/download-solution`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );

  if (!response.ok || !response.body) {
    // Forwarding core-api's status keeps its reason -- a refusal stays a refusal rather than
    // becoming this app's 500.
    return NextResponse.json(
      { error: "The reference solution archive could not be downloaded." },
      { status: response.status === 200 ? 502 : response.status },
    );
  }

  const headers = new Headers();
  headers.set("Content-Type", response.headers.get("content-type") ?? "application/zip");
  headers.set(
    "Content-Disposition",
    response.headers.get("content-disposition") ??
      `attachment; filename="reference-solution-${solutionId}.zip"`,
  );
  const length = response.headers.get("content-length");
  if (length) headers.set("Content-Length", length);

  return new Response(response.body, { status: 200, headers });
}
