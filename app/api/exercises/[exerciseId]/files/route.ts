import { NextResponse } from "next/server";

import { readSessionToken } from "@/lib/auth/session-cookie";

/**
 * Downloading an exercise's own files as the archive core-api builds (T-023).
 *
 * The same shape as S-017's solution download and for the same two reasons: the response is a ZIP
 * rather than JSON, so it cannot go through `lib/api/client.ts`, which unwraps core-api's
 * `{success, payload}` envelope; and streaming `response.body` straight through hands the bytes to
 * the browser without the server holding an exercise's whole test data in memory.
 *
 * The token is read from the httpOnly cookie server-side and never reaches the browser (brief §5)
 * -- the link the settings page renders points at this app. core-api re-checks the reader on the
 * call below, so this is not authorisation; the link simply cannot be followed by anybody whose
 * cookie does not carry a token core-api accepts.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ exerciseId: string }> },
) {
  const { exerciseId } = await params;
  const token = await readSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const apiBase = process.env.API_BASE_INTERNAL;
  if (!apiBase) {
    throw new Error("API_BASE_INTERNAL is not set.");
  }

  const response = await fetch(
    `${apiBase}/exercises/${encodeURIComponent(exerciseId)}/files/download-archive`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );

  if (!response.ok || !response.body) {
    return NextResponse.json(
      { error: "The exercise files could not be downloaded." },
      { status: response.status === 200 ? 502 : response.status },
    );
  }

  const headers = new Headers();
  headers.set("Content-Type", response.headers.get("Content-Type") ?? "application/zip");
  headers.set(
    "Content-Disposition",
    response.headers.get("Content-Disposition") ?? `attachment; filename="exercise-files.zip"`,
  );
  const length = response.headers.get("Content-Length");
  if (length) headers.set("Content-Length", length);

  return new NextResponse(response.body, { status: 200, headers });
}
