import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";

const bodySchema = z.object({
  scopes: z.array(z.string()).min(1),
  expiration: z.number().int().positive().optional(),
  effectiveRole: z.string().optional(),
});

interface CoreApiErrorResponse {
  error?: { message?: string };
}

/**
 * Auth BFF restricted (application/personal-access) token generation. `POST
 * /v1/login/issue-restricted-token` (confirmed against `docs/swagger.yaml` and
 * `LoginPresenter::actionIssueRestrictedToken()`), authenticated with the caller's own session
 * token, issuing a *new*, separate token narrowed to whatever `scopes` (and optionally
 * `effectiveRole`, `expiration`) the caller asks for -- confirmed in the legacy app
 * (`GenerateTokenForm.js`) that this is a self-service "Generate Application Token" feature: a
 * user explicitly requests a scope-restricted token to paste into an external script or tool, the
 * same idea as a GitHub/GitLab personal access token.
 *
 * **Deliberately does not touch `establishSession()` or the session cookie at all** -- unlike
 * every other route in this module (login, the external callback, takeover), the token this route
 * produces is not meant to replace *this* browser's own session; it is a distinct, caller-visible
 * credential meant to leave the app entirely. Consequently, **this route deliberately returns a
 * raw token in its JSON response body** -- the one intentional exception to DEC-021 ("client
 * components never see the token"), because handing the token to the client for the user to copy
 * is the entire point of the feature, not an accidental leak. This is a different kind of token
 * from the httpOnly session cookie DEC-021 is about: it's short-lived-by-choice, scope-restricted
 * by the caller's own request, and explicitly requested for use *outside* this app.
 *
 * Requires only that a session exists (401 if not) and forwards it as `Authorization: Bearer
 * <token>` -- core-api decides everything else: `checkIssueRestrictedToken()` requires the
 * caller's own token to already carry the `master` scope (a BFF session always does, since every
 * token this app ever stores comes from login/takeover/refresh, all of which issue
 * `master`+`refresh`), and `validateScopeRoles()`/`validateEffectiveRole()` reject forbidden
 * scopes (`change-password`, `email-verification`) and unknown role names. `scopes` is validated
 * here only as "a non-empty array of strings," not against a hardcoded enum of known scope
 * values: core-api's own `TokenScope` set is what actually governs this, and mirroring it here as
 * a fixed list would just be one more place for the two to drift apart -- any truly invalid or
 * forbidden scope is still correctly rejected downstream and surfaced as a JSON error.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid request." }, { status: 400 });
  }

  const apiBase = process.env.API_BASE_INTERNAL;
  if (!apiBase) {
    throw new Error("API_BASE_INTERNAL is not set.");
  }

  const apiResponse = await fetch(`${apiBase}/login/issue-restricted-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify(parsed.data),
  });

  if (!apiResponse.ok) {
    const errorBody: CoreApiErrorResponse = await apiResponse.json().catch(() => ({}));
    return NextResponse.json(
      { success: false, message: errorBody.error?.message ?? "Unable to generate token." },
      { status: apiResponse.status },
    );
  }

  const { payload } = (await apiResponse.json()) as { payload: { accessToken: string } };

  return NextResponse.json({ success: true, accessToken: payload.accessToken });
}
