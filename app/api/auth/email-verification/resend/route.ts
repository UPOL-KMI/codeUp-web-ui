import { NextResponse } from "next/server";

import { readSessionToken } from "@/lib/auth/session-cookie";

interface CoreApiErrorResponse {
  error?: { message?: string };
}

/**
 * Asking for the verification email again (A-006), for whoever is signed in.
 *
 * Unlike the verification itself, this one **is** the session's own call: core-api sends the
 * message to the address on the account, so there is nothing for the caller to name -- and
 * nothing it could name that would let it send mail to somebody else's address.
 *
 * `readSessionToken` rather than `requireSession()`: this is called by `fetch` from the dashboard's
 * callout, and a redirect to `/login` would arrive there as a 200 page of HTML rather than a
 * failure it can report (`session-cookie.ts`'s own note).
 */
export async function POST() {
  const token = await readSessionToken();
  if (!token) {
    return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
  }

  const apiBase = process.env.API_BASE_INTERNAL;
  if (!apiBase) {
    throw new Error("API_BASE_INTERNAL is not set.");
  }

  const apiResponse = await fetch(`${apiBase}/email-verification/resend`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!apiResponse.ok) {
    const errorBody: CoreApiErrorResponse = await apiResponse.json().catch(() => ({}));
    return NextResponse.json(
      { success: false, message: errorBody.error?.message ?? "The message could not be sent." },
      { status: apiResponse.status === 500 ? 502 : apiResponse.status },
    );
  }

  return NextResponse.json({ success: true });
}
