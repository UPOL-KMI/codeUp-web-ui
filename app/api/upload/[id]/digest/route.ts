import { NextResponse } from "next/server";
import { z } from "zod";

import { proxyToCoreApi } from "@/lib/upload/core-api-proxy";

/**
 * `GET /v1/uploaded-files/{id}/digest` -- the server's own checksum of a finished upload
 * (`{algorithm: "sha1", digest}`, per `UploadedFilesPresenter::actionDigest()`). The browser
 * recomputes the same digest over the bytes it still holds and compares, which is the only step
 * in this flow that can actually catch a file corrupted in transit; the legacy app does exactly
 * this and D-005 reproduces it (see `verifyDigest` in `lib/upload/chunked-upload.ts` for the one
 * documented case where it degrades to a skip).
 */
const idSchema = z.uuid();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json(
      { success: false, error: { code: "400-000", message: "Invalid file id." } },
      { status: 400 },
    );
  }

  return proxyToCoreApi({ method: "GET", path: `/uploaded-files/${id}/digest` });
}
