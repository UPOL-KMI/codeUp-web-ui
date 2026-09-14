import { NextResponse } from "next/server";
import { z } from "zod";

const changeSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(2),
});

interface CoreApiErrorResponse {
  error?: { code?: string };
}

/**
 * Setting a new password from the link in the email (A-005).
 *
 * **The token comes from the request body and is used as the bearer for exactly this one call.**
 * It is not a session: core-api issues it with the `change-password` scope and refuses everything
 * else with it, so it must never be established as one -- and after the change core-api sets the
 * user's token validity threshold, which invalidates it and every other token they hold. The
 * reader signs in afterwards with the new password, which is the whole point.
 *
 * Whatever core-api says about a refused token is passed through: "you cannot reset your password
 * with this access token" (a wrong scope) and an expired signature are different problems for the
 * reader, and a generic sentence would hide which one they have.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = changeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid request." }, { status: 400 });
  }

  const apiBase = process.env.API_BASE_INTERNAL;
  if (!apiBase) {
    throw new Error("API_BASE_INTERNAL is not set.");
  }

  const apiResponse = await fetch(`${apiBase}/forgotten-password/change`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${parsed.data.token}`,
    },
    body: JSON.stringify({ password: parsed.data.password }),
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
