import { NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({ email: z.email() });

/**
 * Asking for a password-reset email (A-004).
 *
 * **It answers the same way whether or not the address has an account.** core-api's
 * `ForgottenPasswordPresenter::actionDefault` throws `NotFound` for an unknown login, and passing
 * that through would turn this form into an account-existence oracle for anybody with a list of
 * addresses. The reader is told a message is on its way if the address is known -- which is true,
 * and is what a reset form should say.
 *
 * A Route Handler rather than a Server Action for the same reason login is one (brief §5): it is
 * the auth boundary's own surface, it takes no session, and it must not leak core-api's status
 * codes to the caller.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid request." }, { status: 400 });
  }

  const apiBase = process.env.API_BASE_INTERNAL;
  if (!apiBase) {
    throw new Error("API_BASE_INTERNAL is not set.");
  }

  // The username core-api wants here is the email address, as it is at login (F-016's note).
  await fetch(`${apiBase}/forgotten-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: parsed.data.email }),
  }).catch(() => null);

  return NextResponse.json({ success: true });
}
