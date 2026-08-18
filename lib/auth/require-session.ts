import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { decodeJwtPayload } from "./jwt";
import { SESSION_COOKIE_NAME } from "./session-cookie";

export interface Session {
  token: string;
  userId: string;
}

function decodeSessionCookie(value: string): Session | null {
  const payload = decodeJwtPayload(value);
  if (!payload) return null;
  if (payload.exp * 1000 <= Date.now()) return null; // expired -- F-018 handles refresh, not this
  return { token: value, userId: payload.sub };
}

/**
 * The one authorisation boundary (brief §5): every function that touches core-api calls this
 * itself -- not the caller, not the page, not the layout. Works uniformly in Server Components,
 * Server Actions, and Route Handlers (`redirect()` is supported in all three, confirmed in
 * node_modules/next/dist/docs/.../redirect.md).
 *
 * Redirects to /login if there's no usable session. proxy.ts (F-014) already does this as a UX
 * nicety before most pages even render, but that check can be bypassed (brief's own citation:
 * four of the thirteen May 2026 advisories were middleware/proxy bypasses) or simply doesn't
 * apply (a Server Action invoked after the page's session cookie has since expired) -- this is
 * the check that actually matters. Deliberately doesn't carry a `?from=` return URL the way
 * proxy.ts's redirect does: this is the defense-in-depth/direct-invocation path, not the common
 * case, and isn't worth threading the current path through every caller for.
 *
 * No signature verification: this cookie only ever holds a token *we* set after receiving it
 * verbatim from core-api's own login response (F-016), so verifying our own signature would
 * prove nothing we don't already know. The real validation happens naturally when core-api
 * rejects an invalid or expired Authorization header on the next actual API call.
 */
export async function requireSession(): Promise<Session> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);
  const session = cookie ? decodeSessionCookie(cookie.value) : null;

  if (!session) {
    redirect("/login");
  }

  return session;
}
