import { NextResponse } from "next/server";
import { z } from "zod";

const verifySchema = z.object({ token: z.string().min(1) });

interface CoreApiErrorResponse {
  error?: { code?: string };
}

/**
 * Confirming an email address from the link that was sent to it (A-006).
 *
 * **The token from the link is the identity for this one call.** core-api's
 * `EmailVerificationPresenter::actionEmailVerification` is `@LoggedIn` and reads the *token's* own
 * user and `email` payload -- it verifies that the address in the token still matches the account's
 * -- so the link must be presented as the bearer, and must not become a session: it carries the
 * `email-verification` scope and nothing else.
 *
 * A reader who is already signed in as somebody else is not a problem here for the same reason:
 * this call ignores the session cookie entirely and answers about whoever the link belongs to.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid request." }, { status: 400 });
  }

  const apiBase = process.env.API_BASE_INTERNAL;
  if (!apiBase) {
    throw new Error("API_BASE_INTERNAL is not set.");
  }

  const apiResponse = await fetch(`${apiBase}/email-verification/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${parsed.data.token}`,
    },
  });

  if (!apiResponse.ok) {
    const errorBody: CoreApiErrorResponse = await apiResponse.json().catch(() => ({}));
    return NextResponse.json(
      { success: false, code: errorBody.error?.code },
      { status: apiResponse.status === 500 ? 502 : apiResponse.status },
    );
  }

  return NextResponse.json({ success: true });
}
