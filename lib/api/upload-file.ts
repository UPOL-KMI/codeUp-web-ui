import "server-only";

import { requireSession } from "@/lib/auth/require-session";

/**
 * Uploads one small file to core-api in a single request, as the reader.
 *
 * **Not the path a person's upload takes.** A solution or an attachment goes through D-005's
 * chunked Route Handler, because it can be tens of megabytes and a Server Action's body limit is
 * about one. This exists for files the *app itself* generates -- a few hundred bytes, written on
 * the server, never held in a browser -- where a chunked upload would be machinery for nothing.
 *
 * `apiPost` cannot do it: every call it makes is JSON, and `POST /v1/uploaded-files` is multipart.
 */
export async function uploadTextFile(name: string, contents: string): Promise<{ id: string }> {
  const session = await requireSession();
  const apiBase = process.env.API_BASE_INTERNAL;
  if (!apiBase) throw new Error("API_BASE_INTERNAL is not set.");

  const form = new FormData();
  form.append("file", new Blob([contents], { type: "text/plain" }), name);

  const response = await fetch(`${apiBase}/uploaded-files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.token}` },
    body: form,
    cache: "no-store",
  });

  const envelope = (await response.json()) as {
    success?: boolean;
    payload?: { id: string };
    error?: { message?: string };
  };
  if (!response.ok || !envelope.success || !envelope.payload) {
    throw new Error(envelope.error?.message ?? `Upload failed (HTTP ${response.status})`);
  }
  return { id: envelope.payload.id };
}

/**
 * Reads one of core-api's uploaded files back as text, or null when it cannot be read.
 *
 * Used to recognise a file this app wrote earlier -- the only safe way to replace one of its own
 * generated files without touching one a teacher has since edited or written themselves.
 */
export async function readTextFile(fileId: string): Promise<string | null> {
  const session = await requireSession();
  const apiBase = process.env.API_BASE_INTERNAL;
  if (!apiBase) throw new Error("API_BASE_INTERNAL is not set.");

  const response = await fetch(`${apiBase}/uploaded-files/${encodeURIComponent(fileId)}/download`, {
    headers: { Authorization: `Bearer ${session.token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return await response.text();
}
