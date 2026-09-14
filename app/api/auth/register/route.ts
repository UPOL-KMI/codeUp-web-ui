import { NextResponse } from "next/server";
import { z } from "zod";

import { localRegistrationEnabled } from "@/lib/auth/registration";
import { establishSession } from "@/lib/auth/session-cookie";

const registerSchema = z.object({
  email: z.email(),
  firstName: z.string().trim().min(2),
  lastName: z.string().trim().min(2),
  password: z.string().min(1),
  passwordConfirm: z.string().min(1),
  instanceId: z.string().min(1),
  /** Sent on the second attempt, when the reader has seen who else has that name (A-003). */
  ignoreNameCollision: z.boolean().optional(),
});

interface CoreApiErrorResponse {
  error?: { code?: string };
}

interface RegistrationPayload {
  user: { id: string } | null;
  usersWithSameName?: { id: string; fullName: string }[];
  accessToken?: string;
}

/**
 * Creating an account (A-003).
 *
 * **Refused here as well as in core-api when the deployment does not allow it.** core-api's own
 * check is the boundary (`checkCreateAccount`), but it publishes no way to *ask*, so this app
 * carries the same switch the legacy frontend does -- and a route that answered 403 from its own
 * config rather than proxying a form nobody can submit is the honest shape.
 *
 * core-api answers three ways and each is passed through as itself: a created account (with an
 * access token, which becomes the session right here, the way F-016's login does), **a name
 * collision** -- `{user: null, usersWithSameName}` with a 200, which is core-api asking "is one of
 * these you?" and not an error -- or a refusal whose message is the reader's to see ("This email
 * address is already taken.").
 */
export async function POST(request: Request) {
  if (!localRegistrationEnabled()) {
    return NextResponse.json(
      { success: false, message: "Registration is not open on this instance." },
      { status: 403 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid request." }, { status: 400 });
  }

  const apiBase = process.env.API_BASE_INTERNAL;
  if (!apiBase) {
    throw new Error("API_BASE_INTERNAL is not set.");
  }

  const apiResponse = await fetch(`${apiBase}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  if (!apiResponse.ok) {
    const errorBody: CoreApiErrorResponse = await apiResponse.json().catch(() => ({}));
    return NextResponse.json(
      { success: false, code: errorBody.error?.code },
      { status: apiResponse.status === 500 ? 502 : apiResponse.status },
    );
  }

  const { payload } = (await apiResponse.json()) as { payload: RegistrationPayload };

  if (payload.user === null) {
    // Nobody was created: core-api is asking whether one of these people is the same person.
    return NextResponse.json({
      success: false,
      nameCollision: (payload.usersWithSameName ?? []).map((user) => user.fullName),
    });
  }

  if (!payload.accessToken || !(await establishSession(payload.accessToken))) {
    // The account exists, but this app cannot turn what came back into a session -- say so rather
    // than pretend, since signing in with the new password will work.
    return NextResponse.json({ success: true, signedIn: false });
  }

  return NextResponse.json({ success: true, signedIn: true });
}
