import { NextResponse } from "next/server";

import { readSessionToken } from "@/lib/auth/session-cookie";

/**
 * Downloading a solution's files as the archive core-api built (S-017).
 *
 * A Route Handler rather than `lib/api/client.ts`, for the same reason D-005's upload proxy is
 * one: this response is not JSON. The client unwraps core-api's `{success, payload}` envelope and
 * would reject a ZIP outright -- and the point here is to hand the bytes to the browser without
 * buffering them into the server's memory first, which is what returning `response.body` does.
 *
 * The token is read from the httpOnly cookie here, server-side, and never reaches the browser
 * (brief §5): the link the page renders is a link to *this* app.
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
    `${apiBase}/assignment-solutions/${encodeURIComponent(solutionId)}/download-solution`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );

  if (!response.ok || !response.body) {
    // core-api answers a refusal or a missing archive as JSON; forwarding its status keeps the
    // reason ("you cannot access these files") rather than turning every failure into a 500.
    return NextResponse.json(
      { error: "The solution archive could not be downloaded." },
      { status: response.status === 200 ? 502 : response.status },
    );
  }

  const headers = new Headers();
  headers.set("Content-Type", response.headers.get("content-type") ?? "application/zip");
  headers.set(
    "Content-Disposition",
    response.headers.get("content-disposition") ?? `attachment; filename="${solutionId}.zip"`,
  );
  const length = response.headers.get("content-length");
  if (length) headers.set("Content-Length", length);

  return new Response(response.body, { status: 200, headers });
}
