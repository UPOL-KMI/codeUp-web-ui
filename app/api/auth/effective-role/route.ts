import { NextResponse } from "next/server";
import { z } from "zod";

import { decodeJwtPayload } from "@/lib/auth/jwt";
import { establishSession, readSessionToken } from "@/lib/auth/session-cookie";

const bodySchema = z.object({
  /** The role to act as, or null to stop acting as anything and be the account again. */
  role: z.string().min(1).nullable(),
});

interface CoreApiErrorResponse {
  error?: { message?: string };
}

/**
 * Narrowing one's own session to a lesser role, and undoing it (G-023).
 *
 * **The same core-api endpoint as G-020's application tokens, used the opposite way round.** That
 * route issues a credential meant to leave the app and never touches the cookie (DEC-043); this
 * one issues a replacement for *this* browser's session and installs it, which is why it is a
 * second route rather than a flag on the first. DEC-043 deferred this to "a future ticket" and the
 * ticket was never filed -- G-023 is it.
 *
 * **It re-issues the token the caller already holds, with one claim changed.** The scopes and the
 * remaining lifetime are read off the current token and sent back unchanged, exactly as the legacy
 * `restrictEffectiveRole` does -- so narrowing does not quietly widen a session's scopes or extend
 * its life. Only `effectiveRole` differs, and omitting it is how core-api says "none", which is
 * the way back.
 *
 * **This is "view as", not dropping privileges, and the wording in the UI says so** because the
 * mechanism cannot enforce anything: `validateEffectiveRole` compares the requested role against
 * the **account's** role in the database rather than the calling token's, so a narrowed session can
 * ask for its full role back and be granted it. Verified live -- a token narrowed to `student`
 * successfully re-issued itself as `superadmin`. Anyone reading this as a containment boundary
 * would be wrong, which is precisely why it is recorded here.
 *
 * No role check of its own beyond a live session: core-api refuses a role above the account's with
 * a 400 naming both, and that message is forwarded verbatim.
 */
export async function POST(request: Request) {
  const sessionToken = await readSessionToken();
  if (!sessionToken) {
    return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid request." }, { status: 400 });
  }

  const claims = decodeJwtPayload(sessionToken);
  if (!claims) {
    return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
  }

  const apiBase = process.env.API_BASE_INTERNAL;
  if (!apiBase) {
    throw new Error("API_BASE_INTERNAL is not set.");
  }

  // Both read off the token rather than chosen here, so this cannot widen what it re-issues. The
  // scopes claim is core-api's own; a token without one would be one this app never stored.
  const scopes = claims.scopes?.length ? claims.scopes : ["master", "refresh"];
  const expiration = Math.max(60, Math.floor(claims.exp - Date.now() / 1000));

  const apiResponse = await fetch(`${apiBase}/login/issue-restricted-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({
      scopes,
      expiration,
      // Omitted, not null: core-api reads a missing field as "no effective role", which is the
      // only way back to being the account again.
      ...(parsed.data.role !== null && { effectiveRole: parsed.data.role }),
    }),
  });

  if (!apiResponse.ok) {
    const errorBody: CoreApiErrorResponse = await apiResponse.json().catch(() => ({}));
    return NextResponse.json(
      { success: false, message: errorBody.error?.message ?? "Unable to change role." },
      { status: apiResponse.status },
    );
  }

  const { payload } = (await apiResponse.json()) as { payload: { accessToken: string } };
  if (!(await establishSession(payload.accessToken))) {
    return NextResponse.json(
      { success: false, message: "Unable to change role." },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true, role: parsed.data.role });
}
