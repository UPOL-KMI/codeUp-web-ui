import { NextResponse } from "next/server";
import { z } from "zod";

import { defaultPageRoute } from "@/lib/api/ui-preferences";
import { establishSession } from "@/lib/auth/session-cookie";
import { shortSessionSeconds } from "@/lib/auth/short-session";

// z.email(), not the deprecated z.string().email() chain -- verified against the installed zod
// 4.4.3's own type defs, which flag the chained form deprecated in favor of this.
const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  /** A-002's "short session" checkbox. The *length* is the deployment's, not the caller's. */
  short: z.boolean().optional(),
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

  const shortSession = shortSessionSeconds();
  const apiResponse = await fetch(`${apiBase}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: parsed.data.email,
      password: parsed.data.password,
      // core-api sizes the token it issues; `establishSession` then sizes the cookie from that
      // token's own `exp`, so asking for a shorter session needs nothing else here.
      ...(parsed.data.short && shortSession !== null && { expiration: shortSession }),
    }),
  });

  if (!apiResponse.ok) {
    const errorBody: CoreApiErrorResponse = await apiResponse.json().catch(() => ({}));
    return NextResponse.json(
      { success: false, message: errorBody.error?.message ?? "Invalid credentials." },
      { status: 401 },
    );
  }

  const { payload } = (await apiResponse.json()) as {
    payload: {
      accessToken: string;
      // G-022: core-api's login response already carries the reader's stored preferences, so
      // honouring "default page (after login)" costs no request of its own.
      user?: { privateData?: { uiData?: { defaultPage?: string | null } | null } };
    };
  };

  // core-api returned something that isn't a JWT we can read the expiry of -- fail closed rather
  // than set a cookie we can't reason about.
  if (!(await establishSession(payload.accessToken))) {
    throw new Error("Login response from core-api did not contain a decodable access token.");
  }

  // G-022. The form uses this as its fallback destination -- `?from=` still wins, because being
  // returned to the page you were refused is more useful than any stored preference.
  return NextResponse.json({
    success: true,
    defaultPage: defaultPageRoute(payload.user?.privateData?.uiData?.defaultPage),
  });
}
