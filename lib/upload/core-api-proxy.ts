import "server-only";

import { NextResponse } from "next/server";

import { readSessionToken } from "@/lib/auth/session-cookie";

/**
 * The upload module's one gateway to core-api (D-005). Deliberately *not* `lib/api/client.ts`:
 * that client is built for JSON request/response pairs against the generated `paths` type and
 * calls `requireSession()`, which redirects. Chunk append is neither -- it forwards an opaque
 * binary stream, and every route here is called by client-side `fetch()`, which needs a JSON 401
 * rather than a redirect to a login page (see `readSessionToken`'s own note).
 *
 * Keeps core-api's response envelope shape (`{success, error, payload}`) on the way back out
 * instead of flattening it, so the browser-side orchestrator (`lib/upload/chunked-upload.ts`) can
 * branch on exactly the same shape the rest of the app already reasons about, including the
 * stable `code` string (`FrontendErrorMappings`) a later ticket's localised error table will key
 * on. The token itself never crosses the boundary -- it is read from the httpOnly cookie here,
 * server-side, on every single chunk (brief §5 / DEC-021).
 */
export interface ProxyRequest {
  method: string;
  /** Path below core-api's `/v1`, e.g. `/uploaded-files/partial`. Query string included. */
  path: string;
  body?: BodyInit | ReadableStream<Uint8Array> | null;
  contentType?: string;
}

export async function proxyToCoreApi({
  method,
  path,
  body,
  contentType,
}: ProxyRequest): Promise<Response> {
  const token = await readSessionToken();
  if (!token) {
    return NextResponse.json(
      { success: false, error: { code: "401-000", message: "Not authenticated." } },
      { status: 401 },
    );
  }

  const apiBase = process.env.API_BASE_INTERNAL;
  if (!apiBase) {
    throw new Error("API_BASE_INTERNAL is not set.");
  }

  // `duplex: "half"` is mandatory whenever the body is a stream -- undici (Node's fetch, what Next
  // runs on) throws `RequestInit: duplex option is required when sending a body` otherwise. It is
  // still missing from the DOM `RequestInit` lib types this project compiles against, hence the
  // cast rather than a plain property; checked against the installed @types/node rather than
  // assumed, and kept narrow (one extra known key) instead of casting the whole init to `any`.
  const streaming = body instanceof ReadableStream;
  const init = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(contentType && { "Content-Type": contentType }),
    },
    body: body ?? undefined,
    ...(streaming && { duplex: "half" as const }),
  } as RequestInit;

  const response = await fetch(`${apiBase}${path}`, init);

  const contentTypeHeader = response.headers.get("content-type") ?? "";
  if (!contentTypeHeader.includes("json")) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "unknown",
          message: `Unexpected non-JSON response (HTTP ${response.status})`,
        },
      },
      { status: response.status === 200 ? 502 : response.status },
    );
  }

  const envelope: unknown = await response.json();
  return NextResponse.json(envelope, { status: response.status });
}
