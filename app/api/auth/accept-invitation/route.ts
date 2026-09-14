import { NextResponse } from "next/server";
import { z } from "zod";

import { establishSession } from "@/lib/auth/session-cookie";

const acceptSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(1),
  passwordConfirm: z.string().min(1),
});

interface CoreApiErrorResponse {
  error?: { code?: string };
}

/**
 * Accepting an emailed invitation (S-024), in the auth BFF because **it mints a session**.
 *
 * core-api answers `201` with `{user, accessToken}` -- "so the user can log-in right away", in its
 * own comment -- so this is a registration and a login in one call, and the cookie has to be set
 * from the response exactly as F-016's login route does. That is why it lives here and not in a
 * Server Action: every place in this app that turns a core-api token into a session cookie is a
 * Route Handler under `app/api/auth/`, which is also why S-022's password change signs out through
 * `/api/auth/logout` rather than clearing the cookie itself.
 *
 * The endpoint is not only "create an account": core-api looks the email up first and, when a
 * login already exists, signs that person in and adds them to the invited groups instead
 * (`RegistrationPresenter::actionAcceptInvitation`). Either way the answer here is the same.
 *
 * Both passwords are forwarded rather than the confirmation being dropped after a local check --
 * core-api compares them itself (`400-102`) and is the authority on its own registration rules.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid request." }, { status: 400 });
  }

  const apiBase = process.env.API_BASE_INTERNAL;
  if (!apiBase) {
    throw new Error("API_BASE_INTERNAL is not set.");
  }

  const apiResponse = await fetch(`${apiBase}/users/accept-invitation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  if (!apiResponse.ok) {
    const errorBody: CoreApiErrorResponse = await apiResponse.json().catch(() => ({}));
    return NextResponse.json(
      { success: false, code: errorBody.error?.code },
      { status: apiResponse.status },
    );
  }

  const { payload } = (await apiResponse.json()) as { payload: { accessToken: string } };

  if (!(await establishSession(payload.accessToken))) {
    throw new Error("Accept-invitation response from core-api did not contain a decodable token.");
  }

  return NextResponse.json({ success: true });
}
