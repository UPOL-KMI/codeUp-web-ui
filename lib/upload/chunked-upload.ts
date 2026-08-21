import {
  CHUNK_FAST_MS,
  CHUNK_SLOW_MS,
  FILENAME_PATTERN,
  INITIAL_CHUNK_BYTES,
  MAX_CHUNK_BYTES,
  MAX_UPLOAD_BYTES,
  MIN_CHUNK_BYTES,
} from "./limits";

/**
 * Browser-side per-partes upload orchestrator (D-005). Reproduces the legacy app's protocol
 * exactly -- start, adaptive-size chunk loop, finalize, verify checksum, cancel -- because brief
 * §6.7 asks for precisely that ("If the legacy app chunks large uploads, find out and reproduce
 * that"), and it does: `repos/web-app/src/redux/modules/upload.js` +
 * `containers/UploadContainer/UploadContainer.js`, cross-checked against core-api's
 * `UploadedFilesPresenter` rather than inferred from the client alone.
 *
 * **Why the chunking stays in the browser** rather than "send the whole file to a Route Handler
 * and let the server chunk it", which brief §6.7's wording alone would also permit: three of this
 * flow's four user-visible properties only exist if the browser keeps the bytes. Real progress
 * (a server-side loop can only report browser→Next transfer, which finishes long before the file
 * reaches core-api), cancel that actually stops work in progress, and above all the checksum
 * check -- comparing core-api's digest against bytes the *server* sent it verifies nothing, since
 * both sides of that comparison derive from the same copy. Verified end to end against the local
 * stack; see DEC-053.
 *
 * The session token is never involved here: every request goes to this app's own
 * `/api/upload/...` Route Handlers, which read the httpOnly cookie server-side and attach the
 * `Authorization` header themselves (brief §5 / DEC-021).
 */

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
}

interface PartialFile {
  id: string;
  totalSize: number;
  uploadedSize: number;
}

interface Envelope<T> {
  success: boolean;
  error?: { code: string; message: string };
  payload?: T;
}

/**
 * Carries core-api's own stable error `code` (`FrontendErrorMappings`, e.g. `"400-004"`) next to
 * a fallback English message, the same contract `ApiError` in `lib/api/client.ts` established --
 * so the localised error table a later ticket builds can key on one thing across both paths.
 */
export class UploadError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "UploadError";
    this.code = code;
  }
}

export interface ChunkedUploadOptions {
  /** Called after every acknowledged chunk with core-api's own accounting, not an optimistic local guess. */
  onProgress?: (uploadedBytes: number, totalBytes: number) => void;
  /** Aborts the in-flight chunk and cancels the partial upload server-side before rejecting. */
  signal?: AbortSignal;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new UploadError("network", "The upload connection failed.");
  }

  const envelope = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!envelope?.success || envelope.payload === undefined) {
    throw new UploadError(
      envelope?.error?.code ?? "unknown",
      envelope?.error?.message ?? `The upload request failed (HTTP ${response.status}).`,
    );
  }
  return envelope.payload;
}

/**
 * Compares core-api's digest of the finished file against one computed locally over the same
 * `File` object still held in memory.
 *
 * **Degrades to a skip when `crypto.subtle` is unavailable, rather than failing the upload.**
 * `crypto.subtle` only exists in a secure context, so on a plain-HTTP deployment reached by
 * hostname (exactly how this stack runs locally -- `http://recodex.local:3001`, and `localhost`
 * is the only http origin browsers treat as trustworthy) it is `undefined`. The legacy app hits
 * the same wall and throws a bare `TypeError` there; failing an upload that genuinely succeeded,
 * over a check the environment cannot perform, is the worse of the two behaviours. The upload is
 * already complete and durable by this point -- verification is an extra guarantee, not part of
 * the transfer. Returns whether the check actually ran so a caller can surface the difference.
 */
async function verifyDigest(file: File, uploadedFileId: string): Promise<boolean> {
  const { algorithm, digest } = await requestJson<{ algorithm: string; digest: string }>(
    `/api/upload/${uploadedFileId}/digest`,
  );

  if (algorithm !== "sha1") return false; // unknown algorithm: nothing to compare against
  if (!globalThis.crypto?.subtle) return false; // insecure context, see above

  const localDigest = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-1", await file.arrayBuffer())),
  )
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  if (localDigest !== digest) {
    throw new UploadError(
      "digest-mismatch",
      "The uploaded file's checksum does not match. The file may have been damaged in transit.",
    );
  }
  return true;
}

async function cancelPartial(partialFileId: string): Promise<void> {
  // Deliberately without the caller's `signal`: this is the cleanup that runs *because* the caller
  // aborted, so reusing their already-aborted signal would cancel the cancellation and leave
  // orphaned chunks on the server until its own maintenance cleanup notices them.
  await fetch(`/api/upload/partial/${partialFileId}`, { method: "DELETE" }).catch(() => undefined);
}

export async function uploadFileChunked(
  file: File,
  { onProgress, signal }: ChunkedUploadOptions = {},
): Promise<UploadedFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError("400-004", "The file is larger than the 512 MiB upload limit.");
  }
  if (!FILENAME_PATTERN.test(file.name)) {
    throw new UploadError("400-003", "The file name contains characters the server rejects.");
  }

  signal?.throwIfAborted();

  let partial = await requestJson<PartialFile>("/api/upload/partial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size }),
  });

  const partialFileId = partial.id; // kept separately: still needed to cancel if a response is malformed
  let chunkBytes = INITIAL_CHUNK_BYTES;
  let completed = false;

  try {
    onProgress?.(0, file.size);

    while (partial.uploadedSize < partial.totalSize) {
      signal?.throwIfAborted();

      const offset = partial.uploadedSize;
      const size = Math.min(chunkBytes, partial.totalSize - offset);

      const startedAt = Date.now();
      partial = await requestJson<PartialFile>(
        `/api/upload/partial/${partialFileId}?offset=${offset}`,
        { method: "PUT", body: file.slice(offset, offset + size), signal },
      );
      const elapsed = Date.now() - startedAt;

      if (partial.id !== partialFileId) {
        throw new UploadError("unknown", "The server returned an unexpected upload state.");
      }

      onProgress?.(partial.uploadedSize, partial.totalSize);

      // Adaptive sizing, legacy's own thresholds (see limits.ts): aim for a chunk that takes a
      // couple of seconds, so progress stays responsive on a slow link without paying a round
      // trip per 64 KiB on a fast one.
      if (elapsed < CHUNK_FAST_MS && chunkBytes < MAX_CHUNK_BYTES) {
        chunkBytes *= 2;
      } else if (elapsed > CHUNK_SLOW_MS && chunkBytes > MIN_CHUNK_BYTES) {
        chunkBytes /= 2;
      }
    }

    const uploaded = await requestJson<UploadedFile>(`/api/upload/partial/${partialFileId}`, {
      method: "POST",
    });
    completed = true; // past this point the partial file no longer exists to cancel

    await verifyDigest(file, uploaded.id);
    return uploaded;
  } catch (error) {
    if (!completed) await cancelPartial(partialFileId);
    throw error;
  }
}
