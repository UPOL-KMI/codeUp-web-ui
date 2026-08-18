import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { establishSession, SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";

const paramsSchema = z.object({ userId: z.uuid() });

interface CoreApiErrorResponse {
  error?: { message?: string };
}

/**
 * Auth BFF user takeover (superadmin only). `POST /v1/login/takeover/{userId}` (confirmed against
 * `docs/swagger.yaml` and `LoginPresenter::actionTakeOver()`) issues a fresh, full-privilege access
 * token for the *target* user, in the same `{payload: {accessToken, user}}` shape as login and the
 * external-auth callback (F-019) -- so this route reuses the same `establishSession()`.
 *
 * Authorization is entirely core-api's job, not this route's: `permissions.neon` allows `takeOver`
 * only for `role: superadmin`, with an explicit `allow: false` safety net underneath for everyone
 * else (checked directly in the PHP config, not assumed). This route only enforces the one thing
 * that's actually its own responsibility -- that *some* caller session exists at all -- and forwards
 * it as `Authorization: Bearer <token>`; core-api's `canTakeOver()` ACL check decides the rest and
 * returns 403 if the caller isn't a superadmin. That 403 is surfaced as JSON here rather than
 * redirecting to `/login` (unlike `requireSession()`'s missing-session case below): the caller *is*
 * logged in, just not allowed to do this specific thing, and looping them back to `/login` would be
 * a confusing dead end, not a fix.
 *
 * `userId` is a path segment, not a body field, mirroring core-api's own URL shape 1:1 (like F-019's
 * `[authenticatorName]`) -- there's nothing else in the request to validate.
 */
export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ success: false, message: "Invalid user id." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
  }

  const apiBase = process.env.API_BASE_INTERNAL;
  if (!apiBase) {
    throw new Error("API_BASE_INTERNAL is not set.");
  }

  const apiResponse = await fetch(
    `${apiBase}/login/takeover/${encodeURIComponent(parsedParams.data.userId)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${sessionToken}` },
    },
  );

  if (!apiResponse.ok) {
    const errorBody: CoreApiErrorResponse = await apiResponse.json().catch(() => ({}));
    return NextResponse.json(
      { success: false, message: errorBody.error?.message ?? "Unable to take over this account." },
      { status: apiResponse.status },
    );
  }

  const { payload } = (await apiResponse.json()) as { payload: { accessToken: string } };

  if (!(await establishSession(payload.accessToken))) {
    throw new Error("Takeover response from core-api did not contain a decodable access token.");
  }

  return NextResponse.json({ success: true });
}
