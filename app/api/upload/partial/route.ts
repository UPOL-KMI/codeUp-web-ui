import { NextResponse } from "next/server";
import { z } from "zod";

import { proxyToCoreApi } from "@/lib/upload/core-api-proxy";
import { FILENAME_PATTERN, MAX_UPLOAD_BYTES } from "@/lib/upload/limits";

/**
 * Starts a per-partes upload: `POST /v1/uploaded-files/partial` (D-005). Confirmed against
 * `UploadedFilesPresenter::actionStartPartial()` -- takes `{name, size}` and returns the
 * `UploadedPartialFile` entity (`{id, name, totalSize, uploadedSize, chunks, ...}`) the chunk loop
 * then drives itself from. The legacy app sends this as JSON despite the presenter reading it via
 * `getRequest()->getPost()` (Nette decodes a JSON body into POST params for these endpoints);
 * matched here rather than second-guessed, since that's the shape production traffic actually
 * uses.
 *
 * Validates size and filename server-side even though `chunked-upload.ts` checks both before
 * calling: the client-side check exists to give a readable message without a round trip, this one
 * exists because a Route Handler is a public HTTP endpoint and "a hidden button is not
 * authorisation" (brief §3.4) applies to limits just as much as to permissions. `size` is only
 * a *declaration* here -- what actually caps the transfer is that core-api rejects any chunk whose
 * offset doesn't match the bytes it has already stored, and refuses to finalize a partial file
 * whose `uploadedSize` never reached `totalSize`.
 */
const startSchema = z.object({
  name: z.string().min(1).max(255).regex(FILENAME_PATTERN),
  size: z.number().int().min(0).max(MAX_UPLOAD_BYTES),
});

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    // Distinguishes the two rejections core-api itself distinguishes -- `400-003`
    // (E400_003__UPLOADED_FILE_INVALID_CHARACTERS) and `400-004`
    // (E400_004__UPLOADED_FILE_INVALID_SIZE), both read from `FrontendErrorMappings.php` -- so a
    // caller that never reaches core-api (because this handler rejected first) still gets the
    // same code it would have got from there. Anything else is a malformed request, not a
    // recognisable upload problem.
    const field = parsed.error.issues[0]?.path[0];
    const code = field === "name" ? "400-003" : field === "size" ? "400-004" : "400-000";
    return NextResponse.json(
      { success: false, error: { code, message: "Invalid upload request." } },
      { status: 400 },
    );
  }

  return proxyToCoreApi({
    method: "POST",
    path: "/uploaded-files/partial",
    body: JSON.stringify(parsed.data),
    contentType: "application/json",
  });
}
