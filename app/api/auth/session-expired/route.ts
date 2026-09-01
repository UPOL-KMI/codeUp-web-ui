import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";
import { buildAbsoluteUrl } from "@/lib/http/absolute-url";

/**
 * Where a render goes when core-api refuses the session it was holding (F-031).
 *
 * `proxy.ts` already catches the ordinary case -- a token past its own `exp` -- and clears it
 * before anything renders. This is the other one: core-api can refuse a token whose `exp` has
 * *not* passed, because a password change sets a token validity threshold (S-022) and an
 * administrator can invalidate every token a user holds. Nothing this app can see says so; the
 * answer arrives as `401-002` on a real call, on a page that is already rendering, where no cookie
 * can be written. So `lib/api/read.ts` sends the reader here instead, and here the cookie can go.
 *
 * **GET, unlike logout's POST.** A redirect cannot be a POST, and the CSRF reasoning that makes
 * logout POST-only does not carry over: an attacker who tricks a browser into this URL clears a
 * cookie core-api has already rejected, which is the same thing the reader's next click would do.
 * It ends a session that has already ended.
 */
export async function GET(request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);

  return NextResponse.redirect(buildAbsoluteUrl(request, "/login"), 303);
}
