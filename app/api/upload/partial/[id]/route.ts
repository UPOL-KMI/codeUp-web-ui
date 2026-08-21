import { NextResponse } from "next/server";
import { z } from "zod";

import { proxyToCoreApi } from "@/lib/upload/core-api-proxy";
import { MAX_CHUNK_BYTES } from "@/lib/upload/limits";

/**
 * The three per-partes operations that address an existing partial file (D-005), confirmed
 * against `UploadedFilesPresenter`: append a chunk (`actionAppendPartial`), finalize
 * (`actionCompletePartial`), cancel and drop the chunks (`actionCancelPartial`). One file because
 * the App Router keys handlers by segment + HTTP method, and core-api uses the same URL for all
 * three.
 *
 * `params` is awaited -- it is a Promise in this Next version (AGENTS.md §6.2), and the id is
 * re-validated as a UUID here rather than passed through: this segment is interpolated into an
 * outbound URL, and "the client sent it" is not a reason to trust its shape.
 */
const idSchema = z.uuid();

async function resolveId(params: Promise<{ id: string }>): Promise<string | null> {
  const { id } = await params;
  return idSchema.safeParse(id).success ? id : null;
}

function invalidId() {
  return NextResponse.json(
    { success: false, error: { code: "400-000", message: "Invalid partial file id." } },
    { status: 400 },
  );
}

/**
 * Append one chunk. The body is forwarded to core-api as an **unbuffered stream** -- brief §6.7's
 * "Route Handler that streams to core-api", and the reason this is a Route Handler at all rather
 * than a Server Action (whose ~1 MB body limit no solution archive would fit under).
 * `storeUploadedPartialFileChunk()` reads the raw request body (`php://input`), so no multipart
 * wrapper is involved on either side; the chunk goes out exactly as it came in.
 *
 * `offset` is core-api's own concurrency control, not ours: it rejects any offset that isn't
 * equal to the bytes it has already stored, which is what makes a resumed or duplicated chunk
 * fail loudly instead of silently corrupting the assembled file.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = await resolveId(params);
  if (!id) return invalidId();

  const offsetParam = new URL(request.url).searchParams.get("offset");
  const offset = Number(offsetParam);
  if (offsetParam === null || !Number.isSafeInteger(offset) || offset < 0) {
    return NextResponse.json(
      { success: false, error: { code: "400-000", message: "Invalid chunk offset." } },
      { status: 400 },
    );
  }

  // Cheap sanity guard, not the real limit: a chunk this size means the caller isn't the
  // orchestrator in `lib/upload/chunked-upload.ts` (whose ceiling is MAX_CHUNK_BYTES). The actual
  // enforcement is core-api's declared-size check plus nginx's `client_max_body_size`; this just
  // refuses an obviously-wrong request before opening an upstream connection for it. Absent
  // Content-Length (a chunked request) is allowed through -- nginx upstream still caps it.
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isSafeInteger(declaredLength) && declaredLength > MAX_CHUNK_BYTES) {
    return NextResponse.json(
      { success: false, error: { code: "413-000", message: "Chunk too large." } },
      { status: 413 },
    );
  }

  return proxyToCoreApi({
    method: "PUT",
    path: `/uploaded-files/partial/${id}?offset=${offset}`,
    body: request.body,
    contentType: "application/octet-stream",
  });
}

/** Finalize: assembles the stored chunks into a real `UploadedFile` entity and returns it. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = await resolveId(params);
  if (!id) return invalidId();

  return proxyToCoreApi({ method: "POST", path: `/uploaded-files/partial/${id}` });
}

/** Cancel: removes every chunk stored so far and the partial-file record itself. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = await resolveId(params);
  if (!id) return invalidId();

  return proxyToCoreApi({ method: "DELETE", path: `/uploaded-files/partial/${id}` });
}
