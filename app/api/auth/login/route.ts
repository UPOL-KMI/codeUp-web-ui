import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { decodeJwtPayload } from "@/lib/auth/jwt";
import { sessionCookieOptions, SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";

// z.email(), not the deprecated z.string().email() chain -- verified against the installed zod
// 4.4.3's own type defs, which flag the chained form deprecated in favor of this.
const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

interface CoreApiErrorResponse {
  error?: { message?: string };
}

/**
 * Auth BFF login (brief §5, corrected from DECISIONS.md's DEC-023: this is a Route Handler, not
 * a Server Action -- the brief is explicit: "Login: Route Handler receives credentials -> calls
 * core-api -> stores the token in an httpOnly, sameSite=lax cookie"). Presents a clean
 * `{email, password}` contract to the frontend and maps to core-api's own `username` field
 * internally -- ReCodEx users authenticate with their email, "username" is just core-api's
 * internal field name for it (confirmed live against the running instance).
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid request." }, { status: 400 });
  }

  const apiBase = process.env.API_BASE_INTERNAL;
  if (!apiBase) {
    throw new Error("API_BASE_INTERNAL is not set.");
  }

  const apiResponse = await fetch(`${apiBase}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: parsed.data.email,
      password: parsed.data.password,
    }),
  });

  if (!apiResponse.ok) {
    const errorBody: CoreApiErrorResponse = await apiResponse.json().catch(() => ({}));
    return NextResponse.json(
      { success: false, message: errorBody.error?.message ?? "Invalid credentials." },
      { status: 401 },
    );
  }

  const { payload } = (await apiResponse.json()) as { payload: { accessToken: string } };
  const { accessToken } = payload;

  const claims = decodeJwtPayload(accessToken);
  if (!claims) {
    // core-api returned something that isn't a JWT we can read the expiry of -- fail closed
    // rather than set a cookie we can't reason about.
    throw new Error("Login response from core-api did not contain a decodable access token.");
  }
  const maxAgeSeconds = Math.max(0, Math.floor(claims.exp - Date.now() / 1000));

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, accessToken, sessionCookieOptions(maxAgeSeconds));

  return NextResponse.json({ success: true });
}
